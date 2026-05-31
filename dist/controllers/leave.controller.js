"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLeave = exports.updateLeaveStatus = exports.getLeaves = exports.applyLeave = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// POST /api/leaves/apply — Doctor applies for leave
const applyLeave = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const userEmail = req.user?.email;
        const role = req.user?.role;
        if (!clinicId || !userEmail)
            return res.status(403).json({ message: "Unauthorized" });
        const { leaveTypeId, leaveTypeName, startDate, endDate, days, reason } = req.body;
        if (!leaveTypeId || !startDate || !endDate) {
            return res.status(400).json({ message: "leaveTypeId, startDate, endDate required" });
        }
        // Resolve the actual Doctor/Staff ID from email (JWT carries User ID, not Doctor ID)
        let employeeId;
        let employeeType;
        if (role === "DOCTOR") {
            const doctor = await prisma_1.default.doctor.findFirst({
                where: { email: userEmail, clinicId }
            });
            if (!doctor)
                return res.status(404).json({ message: "Doctor profile not found for this account. Please ensure the doctor record email matches your login email." });
            employeeId = doctor.id;
            employeeType = "DOCTOR";
        }
        else {
            // STAFF or other: lookup staff by email
            const staff = await prisma_1.default.staff.findFirst({
                where: { email: userEmail, clinicId }
            });
            if (!staff)
                return res.status(404).json({ message: "Staff profile not found for this account." });
            employeeId = staff.id;
            employeeType = "STAFF";
        }
        const leave = await prisma_1.default.leave.create({
            data: {
                clinicId,
                employeeId,
                employeeType,
                leaveTypeId,
                leaveTypeName: leaveTypeName || "",
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                days: days || 1,
                reason: reason || "",
                status: "APPLIED",
            },
        });
        res.status(201).json(leave);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.applyLeave = applyLeave;
// GET /api/leaves — Doctor gets own leaves, Admin gets all
const getLeaves = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const userEmail = req.user?.email;
        const role = req.user?.role;
        if (!clinicId)
            return res.status(403).json({ message: "Unauthorized" });
        const where = { clinicId };
        // Doctors only see their own — resolve Doctor ID from email
        if (role === "DOCTOR") {
            const doctor = await prisma_1.default.doctor.findFirst({
                where: { email: userEmail, clinicId }
            });
            if (doctor) {
                where.employeeId = doctor.id;
            }
            else {
                // No doctor profile found - return empty
                return res.json([]);
            }
        }
        const leaves = await prisma_1.default.leave.findMany({
            where,
            orderBy: { appliedOn: "desc" },
        });
        // Enrich with employee name
        const enriched = await Promise.all(leaves.map(async (leave) => {
            let employeeName = "Unknown";
            let profileImage = "user-08.jpg";
            if (leave.employeeType === "DOCTOR") {
                const doc = await prisma_1.default.doctor.findUnique({ where: { id: leave.employeeId }, select: { fullName: true, profileImage: true } });
                if (doc) {
                    employeeName = doc.fullName;
                    profileImage = doc.profileImage || "user-08.jpg";
                }
            }
            else {
                const st = await prisma_1.default.staff.findUnique({ where: { id: leave.employeeId }, select: { fullName: true, profileImage: true } });
                if (st) {
                    employeeName = st.fullName;
                    profileImage = st.profileImage || "user-05.jpg";
                }
            }
            return { ...leave, employeeName, profileImage };
        }));
        res.json(enriched);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getLeaves = getLeaves;
// PUT /api/leaves/:id/status — Admin approves or rejects; on APPROVED auto-fill attendance
const updateLeaveStatus = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "Unauthorized" });
        const { id } = req.params;
        const { status } = req.body; // APPROVED or REJECTED
        if (!["APPROVED", "REJECTED"].includes(status)) {
            return res.status(400).json({ message: "status must be APPROVED or REJECTED" });
        }
        const leave = await prisma_1.default.leave.findFirst({ where: { id, clinicId } });
        if (!leave)
            return res.status(404).json({ message: "Leave not found" });
        await prisma_1.default.leave.update({ where: { id }, data: { status } });
        // If approved → mark attendance as LEAVE for each day in range
        if (status === "APPROVED") {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const current = new Date(start);
            while (current <= end) {
                const dayDate = new Date(current);
                // Check if day already has an attendance record
                const existing = await prisma_1.default.attendance.findFirst({
                    where: {
                        clinicId,
                        employeeId: leave.employeeId,
                        employeeType: leave.employeeType,
                        date: dayDate,
                    },
                });
                if (existing) {
                    await prisma_1.default.attendance.update({ where: { id: existing.id }, data: { status: "LEAVE" } });
                }
                else {
                    await prisma_1.default.attendance.create({
                        data: {
                            clinicId,
                            employeeId: leave.employeeId,
                            employeeType: leave.employeeType,
                            date: dayDate,
                            status: "LEAVE",
                        },
                    });
                }
                current.setDate(current.getDate() + 1);
            }
        }
        res.json({ message: `Leave ${status.toLowerCase()} successfully` });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateLeaveStatus = updateLeaveStatus;
// DELETE /api/leaves/:id — Employee cancels their own APPLIED leave
const deleteLeave = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const userId = req.user?.id;
        if (!clinicId)
            return res.status(403).json({ message: "Unauthorized" });
        const { id } = req.params;
        await prisma_1.default.leave.deleteMany({ where: { id, clinicId, employeeId: userId, status: "APPLIED" } });
        res.json({ message: "Leave deleted" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteLeave = deleteLeave;
