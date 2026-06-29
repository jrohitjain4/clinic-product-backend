import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";
import bcrypt from "bcryptjs";
import { sendStaffWelcomeEmail } from "../utils/email";

const mapStatusLabel = (status: string) =>
  status === "Active" ? "Available" : "Unavailable";

/** Generate a random 10-char password: letters + digits */
const generateRandomPassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};

// GET /api/staffs
export const getStaffs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const { designationId, role, status } = req.query;

    const staffs = await prisma.staff.findMany({
      where: {
        clinicId,
        ...(designationId && typeof designationId === "string"
          ? { designationId }
          : {}),
        ...(role && typeof role === "string" ? { role } : {}),
        ...(status && typeof status === "string" ? { status } : {}),
      },
      include: {
        designation: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      staffs.map((s) => ({
        ...s,
        statusLabel: mapStatusLabel(s.status),
      }))
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    const isDbDown =
      message.includes("Can't reach database server") ||
      message.includes("Connection timed out") ||
      message.includes("ECONNREFUSED");
    res.status(isDbDown ? 503 : 500).json({
      message: isDbDown
        ? "Database is unreachable. Resume Render Postgres or use local Docker (backend/docker-compose.yml)."
        : message,
    });
  }
};

// GET /api/staffs/:id
export const getStaffById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const staff = await prisma.staff.findFirst({
      where: { id, clinicId: clinicId! },
      include: {
        designation: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (!staff) return res.status(404).json({ message: "Staff not found" });
    res.json({ ...staff, statusLabel: mapStatusLabel(staff.status) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    const isDbDown = message.includes("Can't reach database server");
    res.status(isDbDown ? 503 : 500).json({
      message: isDbDown ? "Database is unreachable." : message,
    });
  }
};

// POST /api/staffs
export const createStaff = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const {
      fullName,
      role,
      designationId,
      departmentId,
      profileImage,
      phone,
      email,
      dob,
      gender,
      bloodGroup,
      address1,
      address2,
      country,
      state,
      city,
      pincode,
      dateOfJoining,
      status,
    } = req.body;

    if (!fullName?.trim()) {
      return res.status(400).json({ message: "Staff name is required" });
    }
    if (!role?.trim()) {
      return res.status(400).json({ message: "Role is required" });
    }

    const count = await prisma.staff.count({ where: { clinicId } });
    const staffCode = `STF${String(count + 1).padStart(3, "0")}`;

    let resolvedDepartmentId = departmentId || null;
    if (!resolvedDepartmentId && designationId) {
      const desig = await prisma.designation.findFirst({
        where: { id: designationId, clinicId },
        select: { departmentId: true },
      });
      resolvedDepartmentId = desig?.departmentId ?? null;
    }

    // Create staff AND user via transaction if email is provided, so they can login.
    let staff;

    if (email) {
      const normalizedEmail = email.trim().toLowerCase();
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } }
      });
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      // Generate a secure random password
      const plainPassword = generateRandomPassword();
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      console.log(`[Staff Created] Email: ${normalizedEmail} | Temp Password: ${plainPassword}`);

      const result = await prisma.$transaction(async (tx) => {
        const createdStaff = await tx.staff.create({
          data: {
            staffCode,
            fullName: fullName.trim(),
            role: role.trim(),
            designationId: designationId || null,
            departmentId: resolvedDepartmentId,
            profileImage: profileImage || null,
            phone: phone || null,
            email: email,
            dob: dob ? new Date(dob) : null,
            gender: gender || null,
            bloodGroup: bloodGroup || null,
            address1: address1 || null,
            address2: address2 || null,
            country: country || null,
            state: state || null,
            city: city || null,
            pincode: pincode || null,
            dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
            status: status || "Active",
            clinicId,
          },
          include: {
            designation: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
          },
        });

        await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            fullName: fullName.trim(),
            role: "STAFF" as any,
            clinicId,
            dob: dob ? new Date(dob) : null,
            gender: gender || null,
          }
        });

        return createdStaff;
      });

      staff = result;

      // Send welcome email with login credentials (non-blocking)
      sendStaffWelcomeEmail(
        normalizedEmail,
        fullName.trim(),
        staffCode,
        role.trim(),
        { username: normalizedEmail, password: plainPassword }
      ).catch((err) => console.error("Staff welcome email failed:", err));

    } else {
      staff = await prisma.staff.create({
        data: {
          staffCode,
          fullName: fullName.trim(),
          role: role.trim(),
          designationId: designationId || null,
          departmentId: resolvedDepartmentId,
          profileImage: profileImage || null,
          phone: phone || null,
          email: email || null,
          dob: dob ? new Date(dob) : null,
          gender: gender || null,
          bloodGroup: bloodGroup || null,
          address1: address1 || null,
          address2: address2 || null,
          country: country || null,
          state: state || null,
          city: city || null,
          pincode: pincode || null,
          dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : new Date(),
          status: status || "Active",
          clinicId,
        },
        include: {
          designation: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
        },
      });
    }

    res.status(201).json({ ...staff, statusLabel: mapStatusLabel(staff.status) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};

// PUT /api/staffs/:id
export const updateStaff = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.staff.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Staff not found" });

    const {
      fullName,
      role,
      designationId,
      departmentId,
      profileImage,
      phone,
      email,
      dob,
      gender,
      bloodGroup,
      address1,
      address2,
      country,
      state,
      city,
      pincode,
      dateOfJoining,
      status,
    } = req.body;

    let resolvedDepartmentId =
      departmentId !== undefined ? departmentId || null : existing.departmentId;
    const desigId = designationId !== undefined ? designationId : existing.designationId;
    if (desigId && departmentId === undefined) {
      const desig = await prisma.designation.findFirst({
        where: { id: desigId, clinicId: clinicId! },
        select: { departmentId: true },
      });
      resolvedDepartmentId = desig?.departmentId ?? resolvedDepartmentId;
    }

    const updated = await prisma.staff.update({
      where: { id },
      data: {
        fullName: fullName ?? existing.fullName,
        role: role ?? existing.role,
        designationId: designationId !== undefined ? designationId || null : existing.designationId,
        departmentId: resolvedDepartmentId,
        profileImage: profileImage !== undefined ? profileImage || null : existing.profileImage,
        phone: phone !== undefined ? phone || null : existing.phone,
        email: email !== undefined ? email || null : existing.email,
        dob: dob ? new Date(dob) : existing.dob,
        gender: gender !== undefined ? gender || null : existing.gender,
        bloodGroup: bloodGroup !== undefined ? bloodGroup || null : existing.bloodGroup,
        address1: address1 !== undefined ? address1 || null : existing.address1,
        address2: address2 !== undefined ? address2 || null : existing.address2,
        country: country !== undefined ? country || null : existing.country,
        state: state !== undefined ? state || null : existing.state,
        city: city !== undefined ? city || null : existing.city,
        pincode: pincode !== undefined ? pincode || null : existing.pincode,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : existing.dateOfJoining,
        status: status ?? existing.status,
      },
      include: {
        designation: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    res.json({ ...updated, statusLabel: mapStatusLabel(updated.status) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};

// DELETE /api/staffs/:id
export const deleteStaff = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.staff.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Staff not found" });

    await prisma.staff.delete({ where: { id } });
    res.json({ message: "Staff deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};

// POST /api/staffs/:id/reset-password
export const resetStaffPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const staff = await prisma.staff.findFirst({ where: { id, clinicId: clinicId! } });
    if (!staff) return res.status(404).json({ message: "Staff not found" });
    if (!staff.email) return res.status(400).json({ message: "Staff has no email address. Please add an email first." });

    const normalizedEmail = staff.email.trim().toLowerCase();
    const newPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log(`[Staff Password Reset] Email: ${normalizedEmail} | New Temp Password: ${newPassword}`);

    // Update existing user record or create one
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } }
    });
    if (existingUser) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { email: normalizedEmail, passwordHash }
      });
    } else {
      await prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          fullName: staff.fullName,
          role: "STAFF" as any,
          clinicId: clinicId!,
          dob: staff.dob,
          gender: staff.gender
        }
      });
    }

    // Send new credentials email (non-blocking)
    sendStaffWelcomeEmail(
      normalizedEmail,
      staff.fullName,
      staff.staffCode || "",
      staff.role,
      { username: normalizedEmail, password: newPassword }
    ).catch((err) => console.error("Staff reset email failed:", err));

    res.json({ message: "Password reset successfully. New credentials have been emailed to the staff member." });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};
