"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetStaffPassword = exports.deleteStaff = exports.updateStaff = exports.createStaff = exports.getStaffById = exports.getStaffs = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const email_1 = require("../utils/email");
const phoneValidation_1 = require("../utils/phoneValidation");
const mapStatusLabel = (status) => status === "Active" ? "Available" : "Unavailable";
/** Generate a random 10-char password: letters + digits */
const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
};
// GET /api/staffs
const getStaffs = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { designationId, role, status } = req.query;
        const staffs = await prisma_1.default.staff.findMany({
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
        res.json(staffs.map((s) => ({
            ...s,
            statusLabel: mapStatusLabel(s.status),
        })));
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        const isDbDown = message.includes("Can't reach database server") ||
            message.includes("Connection timed out") ||
            message.includes("ECONNREFUSED");
        res.status(isDbDown ? 503 : 500).json({
            message: isDbDown
                ? "Database is unreachable. Resume Render Postgres or use local Docker (backend/docker-compose.yml)."
                : message,
        });
    }
};
exports.getStaffs = getStaffs;
// GET /api/staffs/:id
const getStaffById = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const staff = await prisma_1.default.staff.findFirst({
            where: { id, clinicId: clinicId },
            include: {
                designation: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
            },
        });
        if (!staff)
            return res.status(404).json({ message: "Staff not found" });
        res.json({ ...staff, statusLabel: mapStatusLabel(staff.status) });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        const isDbDown = message.includes("Can't reach database server");
        res.status(isDbDown ? 503 : 500).json({
            message: isDbDown ? "Database is unreachable." : message,
        });
    }
};
exports.getStaffById = getStaffById;
// POST /api/staffs
const createStaff = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { fullName, role, designationId, departmentId, profileImage, phone, email, dob, gender, bloodGroup, address1, address2, country, state, city, pincode, dateOfJoining, status, } = req.body;
        if (!fullName?.trim()) {
            return res.status(400).json({ message: "Staff name is required" });
        }
        if (!role?.trim()) {
            return res.status(400).json({ message: "Role is required" });
        }
        if (phone) {
            const duplicate = await (0, phoneValidation_1.checkPhoneDuplicate)(phone);
            if (duplicate) {
                return res.status(400).json({ message: "This phone number is already registered" });
            }
        }
        const count = await prisma_1.default.staff.count({ where: { clinicId } });
        const staffCode = `STF${String(count + 1).padStart(3, "0")}`;
        let resolvedDepartmentId = departmentId || null;
        if (!resolvedDepartmentId && designationId) {
            const desig = await prisma_1.default.designation.findFirst({
                where: { id: designationId, clinicId },
                select: { departmentId: true },
            });
            resolvedDepartmentId = desig?.departmentId ?? null;
        }
        // Create staff AND user via transaction if email is provided, so they can login.
        let staff;
        if (email) {
            const normalizedEmail = email.trim().toLowerCase();
            const existingUser = await prisma_1.default.user.findFirst({
                where: { email: { equals: normalizedEmail, mode: "insensitive" } }
            });
            if (existingUser) {
                return res.status(400).json({ message: "A user with this email already exists" });
            }
            // Generate a secure random password
            const plainPassword = generateRandomPassword();
            const passwordHash = await bcryptjs_1.default.hash(plainPassword, 10);
            console.log(`[Staff Created] Email: ${normalizedEmail} | Temp Password: ${plainPassword}`);
            const result = await prisma_1.default.$transaction(async (tx) => {
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
                        role: "STAFF",
                        clinicId,
                        dob: dob ? new Date(dob) : null,
                        gender: gender || null,
                    }
                });
                return createdStaff;
            });
            staff = result;
            // Send welcome email with login credentials (non-blocking)
            (0, email_1.sendStaffWelcomeEmail)(normalizedEmail, fullName.trim(), staffCode, role.trim(), { username: normalizedEmail, password: plainPassword }).catch((err) => console.error("Staff welcome email failed:", err));
        }
        else {
            staff = await prisma_1.default.staff.create({
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.createStaff = createStaff;
// PUT /api/staffs/:id
const updateStaff = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.staff.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Staff not found" });
        const { fullName, role, designationId, departmentId, profileImage, phone, email, dob, gender, bloodGroup, address1, address2, country, state, city, pincode, dateOfJoining, status, } = req.body;
        if (phone && phone !== existing.phone) {
            const duplicate = await (0, phoneValidation_1.checkPhoneDuplicate)(phone);
            if (duplicate) {
                return res.status(400).json({ message: "This phone number is already registered" });
            }
        }
        let resolvedDepartmentId = departmentId !== undefined ? departmentId || null : existing.departmentId;
        const desigId = designationId !== undefined ? designationId : existing.designationId;
        if (desigId && departmentId === undefined) {
            const desig = await prisma_1.default.designation.findFirst({
                where: { id: desigId, clinicId: clinicId },
                select: { departmentId: true },
            });
            resolvedDepartmentId = desig?.departmentId ?? resolvedDepartmentId;
        }
        const updated = await prisma_1.default.staff.update({
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.updateStaff = updateStaff;
// DELETE /api/staffs/:id
const deleteStaff = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.staff.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Staff not found" });
        await prisma_1.default.staff.delete({ where: { id } });
        res.json({ message: "Staff deleted successfully" });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.deleteStaff = deleteStaff;
// POST /api/staffs/:id/reset-password
const resetStaffPassword = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const staff = await prisma_1.default.staff.findFirst({ where: { id, clinicId: clinicId } });
        if (!staff)
            return res.status(404).json({ message: "Staff not found" });
        if (!staff.email)
            return res.status(400).json({ message: "Staff has no email address. Please add an email first." });
        const normalizedEmail = staff.email.trim().toLowerCase();
        const newPassword = generateRandomPassword();
        const passwordHash = await bcryptjs_1.default.hash(newPassword, 10);
        console.log(`[Staff Password Reset] Email: ${normalizedEmail} | New Temp Password: ${newPassword}`);
        // Update existing user record or create one
        const existingUser = await prisma_1.default.user.findFirst({
            where: { email: { equals: normalizedEmail, mode: "insensitive" } }
        });
        if (existingUser) {
            await prisma_1.default.user.update({
                where: { id: existingUser.id },
                data: { email: normalizedEmail, passwordHash }
            });
        }
        else {
            await prisma_1.default.user.create({
                data: {
                    email: normalizedEmail,
                    passwordHash,
                    fullName: staff.fullName,
                    role: "STAFF",
                    clinicId: clinicId,
                    dob: staff.dob,
                    gender: staff.gender
                }
            });
        }
        // Send new credentials email (non-blocking)
        (0, email_1.sendStaffWelcomeEmail)(normalizedEmail, staff.fullName, staff.staffCode || "", staff.role, { username: normalizedEmail, password: newPassword }).catch((err) => console.error("Staff reset email failed:", err));
        res.json({ message: "Password reset successfully. New credentials have been emailed to the staff member." });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
exports.resetStaffPassword = resetStaffPassword;
