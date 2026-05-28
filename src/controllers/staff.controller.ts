import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const mapStatusLabel = (status: string) =>
  status === "Active" ? "Available" : "Unavailable";

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
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ message: "A user with this email already exists" });
      }

      const passwordHash = await bcrypt.hash("staff123", 10);

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
            email,
            passwordHash,
            fullName: fullName.trim(),
            role: "STAFF" as any, // TypeScript might lag behind generated Prisma Client
            clinicId,
            dob: dob ? new Date(dob) : null,
            gender: gender || null,
          }
        });

        return createdStaff;
      });
      staff = result;
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
