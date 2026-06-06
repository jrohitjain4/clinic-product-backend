"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLeave = exports.withdrawLeave = exports.updateLeaveStatus = exports.getLeaves = exports.calculateLeaveDays = exports.applyLeave = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const workingDays_1 = require("../utils/workingDays");
const email_1 = require("../utils/email");
// POST /api/leaves/apply — Employee applies for leave
const applyLeave = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const userEmail = req.user?.email;
        const role = req.user?.role;
        const userName = req.user?.fullName;
        if (!clinicId || !userEmail)
            return res.status(403).json({ message: "Unauthorized" });
        const { leaveTypeId, leaveTypeName, startDate, endDate, days, reason, subject, isPaid, evidenceFiles } = req.body;
        if (!leaveTypeId || !startDate || !endDate) {
            return res.status(400).json({ message: "leaveTypeId, startDate, endDate required" });
        }
        // 1. Resolve Employee ID
        let employeeId;
        let employeeType;
        if (role === "DOCTOR") {
            const doctor = await prisma_1.default.doctor.findFirst({
                where: { email: userEmail, clinicId }
            });
            if (!doctor)
                return res.status(404).json({ message: "Doctor profile not found." });
            employeeId = doctor.id;
            employeeType = "DOCTOR";
        }
        else {
            const staff = await prisma_1.default.staff.findFirst({
                where: { email: userEmail, clinicId }
            });
            if (!staff)
                return res.status(404).json({ message: "Staff profile not found." });
            employeeId = staff.id;
            employeeType = "STAFF";
        }
        // 2. Calculate actual working days
        const start = new Date(startDate);
        const end = new Date(endDate);
        const workingDays = await (0, workingDays_1.calculateWorkingDays)(clinicId, start, end);
        const leave = await prisma_1.default.leave.create({
            data: {
                clinicId,
                employeeId,
                employeeType,
                leaveTypeId,
                leaveTypeName: leaveTypeName || "",
                subject: subject || null,
                isPaid: isPaid === true || isPaid === "true",
                evidenceFiles: evidenceFiles || [],
                startDate: start,
                endDate: end,
                days: days || (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1,
                workingDays,
                reason: reason || "",
                status: "APPLIED",
            },
        });
        // 3. Notify Admin
        const clinic = await prisma_1.default.clinic.findUnique({ where: { id: clinicId }, select: { ownerEmail: true, name: true } });
        if (clinic?.ownerEmail) {
            await (0, email_1.sendEmail)(clinic.ownerEmail, `New Leave Request - ${userName}`, `<h3>New Leave Request Received</h3>
                 <p><b>Employee:</b> ${userName}</p>
                 <p><b>Type:</b> ${leaveTypeName}</p>
                 <p><b>Dates:</b> ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</p>
                 <p><b>Working Days:</b> ${workingDays}</p>
                 <p><b>Reason:</b> ${reason}</p>
                 <a href="${process.env.FRONTEND_URL}/admin/leaves">Review in Dashboard</a>`);
        }
        res.status(201).json(leave);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.applyLeave = applyLeave;
// GET /api/leaves/calculate-days
const calculateLeaveDays = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate)
            return res.status(400).json({ message: "Dates required" });
        const count = await (0, workingDays_1.calculateWorkingDays)(clinicId, new Date(startDate), new Date(endDate));
        res.json({ count });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.calculateLeaveDays = calculateLeaveDays;
// GET /api/leaves — Employee/Admin fetches leaves
const getLeaves = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const userEmail = req.user?.email;
        const role = req.user?.role;
        if (!clinicId)
            return res.status(403).json({ message: "Unauthorized" });
        const where = { clinicId };
        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
            const employee = await (role === "DOCTOR"
                ? prisma_1.default.doctor.findFirst({ where: { email: userEmail, clinicId } })
                : prisma_1.default.staff.findFirst({ where: { email: userEmail, clinicId } }));
            if (employee)
                where.employeeId = employee.id;
            else
                return res.json([]);
        }
        const leaves = await prisma_1.default.leave.findMany({
            where,
            orderBy: { appliedOn: "desc" },
        });
        // Lazy auto-complete: If leaf is APPROVED and endDate has passed, mark as COMPLETED
        const now = new Date();
        const enriched = await Promise.all(leaves.map(async (leave) => {
            if (leave.status === "APPROVED" && new Date(leave.endDate) < now) {
                await prisma_1.default.leave.update({ where: { id: leave.id }, data: { status: "COMPLETED", completedAt: now } });
                leave.status = "COMPLETED";
            }
            let employeeName = "Unknown";
            let profileImage = "user-08.jpg";
            let email = "";
            if (leave.employeeType === "DOCTOR") {
                const doc = await prisma_1.default.doctor.findUnique({ where: { id: leave.employeeId }, select: { fullName: true, profileImage: true, email: true } });
                if (doc) {
                    employeeName = doc.fullName;
                    profileImage = doc.profileImage || "user-08.jpg";
                    email = doc.email || "";
                }
            }
            else {
                const st = await prisma_1.default.staff.findUnique({ where: { id: leave.employeeId }, select: { fullName: true, profileImage: true, email: true } });
                if (st) {
                    employeeName = st.fullName;
                    profileImage = st.profileImage || "user-05.jpg";
                    email = st.email || "";
                }
            }
            return { ...leave, employeeName, profileImage, email };
        }));
        res.json(enriched);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getLeaves = getLeaves;
// PUT /api/leaves/:id/status — Admin lifecycle management
const updateLeaveStatus = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "Unauthorized" });
        const { id } = req.params;
        const { status, startDate, endDate, isPaid, rejectRemark, adminNotes } = req.body;
        const leave = await prisma_1.default.leave.findFirst({ where: { id, clinicId } });
        if (!leave)
            return res.status(404).json({ message: "Leave not found" });
        // Resolve employee email for notification
        let employeeEmail = "";
        if (leave.employeeType === "DOCTOR") {
            const doc = await prisma_1.default.doctor.findUnique({ where: { id: leave.employeeId }, select: { email: true } });
            employeeEmail = doc?.email || "";
        }
        else {
            const st = await prisma_1.default.staff.findUnique({ where: { id: leave.employeeId }, select: { email: true } });
            employeeEmail = st?.email || "";
        }
        const oldStatus = leave.status;
        const updateData = { status };
        if (status === "APPROVED") {
            if (startDate)
                updateData.startDate = new Date(startDate);
            if (endDate)
                updateData.endDate = new Date(endDate);
            if (isPaid !== undefined)
                updateData.isPaid = isPaid;
            if (adminNotes)
                updateData.adminNotes = adminNotes;
            // Recalculate working days if dates changed
            if (startDate || endDate) {
                updateData.workingDays = await (0, workingDays_1.calculateWorkingDays)(clinicId, updateData.startDate || leave.startDate, updateData.endDate || leave.endDate);
            }
        }
        if (status === "REJECTED") {
            updateData.rejectRemark = rejectRemark || "";
        }
        if (status === "CANCELLED") {
            updateData.cancelledAt = new Date();
        }
        const updatedLeave = await prisma_1.default.leave.update({ where: { id }, data: updateData });
        // Handle Attendance sync
        if (status === "APPROVED") {
            await syncAttendance(clinicId, updatedLeave);
        }
        else if ((status === "REJECTED" || status === "CANCELLED") && oldStatus === "APPROVED") {
            // Remove previous leave attendance if moving away from APPROVED
            await removeAttendance(clinicId, leave);
        }
        // Notify Employee
        if (employeeEmail) {
            await (0, email_1.sendEmail)(employeeEmail, `Leave Request ${status}`, `<h3>Your Leave Request Status Update</h3>
                 <p><b>Status:</b> ${status}</p>
                 <p><b>Dates:</b> ${updatedLeave.startDate.toLocaleDateString()} to ${updatedLeave.endDate.toLocaleDateString()}</p>
                 ${status === "REJECTED" ? `<p><b>Remark:</b> ${rejectRemark}</p>` : ""}
                 <p>Sign in to view details.</p>`);
        }
        res.json({ message: `Leave ${status.toLowerCase()} updated`, leave: updatedLeave });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateLeaveStatus = updateLeaveStatus;
// POST /api/leaves/:id/withdraw — Employee withdraws before startDate
const withdrawLeave = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "Unauthorized" });
        const { id } = req.params;
        const leave = await prisma_1.default.leave.findFirst({ where: { id, clinicId } });
        if (!leave)
            return res.status(404).json({ message: "Leave not found" });
        // Validation: Must be before start date
        if (new Date() >= new Date(leave.startDate)) {
            return res.status(400).json({ message: "Cannot withdraw leave after it has started. Use 'Complete' or contact admin." });
        }
        const updated = await prisma_1.default.leave.update({
            where: { id },
            data: { status: "WITHDRAWN", withdrawnAt: new Date() }
        });
        // Notify Admin
        const clinic = await prisma_1.default.clinic.findUnique({ where: { id: clinicId }, select: { ownerEmail: true } });
        if (clinic?.ownerEmail) {
            await (0, email_1.sendEmail)(clinic.ownerEmail, `Leave Withdrawn - ${req.user?.fullName}`, `<p>Employee <b>${req.user?.fullName}</b> has withdrawn their leave request for ${leave.startDate.toLocaleDateString()}.</p>`);
        }
        res.json({ message: "Leave withdrawn", leave: updated });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.withdrawLeave = withdrawLeave;
// Helper: Sync attendance records
async function syncAttendance(clinicId, leave) {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const current = new Date(start);
    while (current <= end) {
        const dayDate = new Date(current);
        const existing = await prisma_1.default.attendance.findFirst({
            where: { clinicId, employeeId: leave.employeeId, employeeType: leave.employeeType, date: dayDate },
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
// Helper: Remove attendance records
async function removeAttendance(clinicId, leave) {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    await prisma_1.default.attendance.deleteMany({
        where: {
            clinicId,
            employeeId: leave.employeeId,
            employeeType: leave.employeeType,
            date: { gte: start, lte: end },
            status: "LEAVE"
        }
    });
}
const deleteLeave = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        await prisma_1.default.leave.deleteMany({ where: { id, clinicId: clinicId || undefined, status: "APPLIED" } });
        res.json({ message: "Leave deleted" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteLeave = deleteLeave;
