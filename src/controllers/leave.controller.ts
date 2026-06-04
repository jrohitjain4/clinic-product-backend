import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";
import { calculateWorkingDays } from "../utils/workingDays";
import { sendEmail } from "../utils/email";

// POST /api/leaves/apply — Employee applies for leave
export const applyLeave = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const userEmail = req.user?.email as string;
        const role = req.user?.role;
        const userName = req.user?.fullName as string;
        if (!clinicId || !userEmail) return res.status(403).json({ message: "Unauthorized" });

        const { leaveTypeId, leaveTypeName, startDate, endDate, days, reason, subject, isPaid, evidenceFiles } = req.body;
        if (!leaveTypeId || !startDate || !endDate) {
            return res.status(400).json({ message: "leaveTypeId, startDate, endDate required" });
        }

        // 1. Resolve Employee ID
        let employeeId: string;
        let employeeType: string;

        if (role === "DOCTOR") {
            const doctor = await prisma.doctor.findFirst({
                where: { email: userEmail, clinicId }
            });
            if (!doctor) return res.status(404).json({ message: "Doctor profile not found." });
            employeeId = doctor.id;
            employeeType = "DOCTOR";
        } else {
            const staff = await prisma.staff.findFirst({
                where: { email: userEmail, clinicId }
            });
            if (!staff) return res.status(404).json({ message: "Staff profile not found." });
            employeeId = staff.id;
            employeeType = "STAFF";
        }

        // 2. Calculate actual working days
        const start = new Date(startDate);
        const end = new Date(endDate);
        const workingDays = await calculateWorkingDays(clinicId, start, end);

        const leave = await prisma.leave.create({
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
        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { ownerEmail: true, name: true } });
        if (clinic?.ownerEmail) {
            await sendEmail(
                clinic.ownerEmail,
                `New Leave Request - ${userName}`,
                `<h3>New Leave Request Received</h3>
                 <p><b>Employee:</b> ${userName}</p>
                 <p><b>Type:</b> ${leaveTypeName}</p>
                 <p><b>Dates:</b> ${start.toLocaleDateString()} to ${end.toLocaleDateString()}</p>
                 <p><b>Working Days:</b> ${workingDays}</p>
                 <p><b>Reason:</b> ${reason}</p>
                 <a href="${process.env.FRONTEND_URL}/admin/leaves">Review in Dashboard</a>`
            );
        }

        res.status(201).json(leave);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/leaves/calculate-days
export const calculateLeaveDays = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) return res.status(400).json({ message: "Dates required" });

        const count = await calculateWorkingDays(clinicId, new Date(startDate as string), new Date(endDate as string));
        res.json({ count });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/leaves — Employee/Admin fetches leaves
export const getLeaves = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const userEmail = req.user?.email as string;
        const role = req.user?.role;
        if (!clinicId) return res.status(403).json({ message: "Unauthorized" });

        const where: any = { clinicId };

        if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
            const employee = await (role === "DOCTOR"
                ? prisma.doctor.findFirst({ where: { email: userEmail, clinicId } })
                : prisma.staff.findFirst({ where: { email: userEmail, clinicId } }));
            if (employee) where.employeeId = employee.id;
            else return res.json([]);
        }

        const leaves = await prisma.leave.findMany({
            where,
            orderBy: { appliedOn: "desc" },
        });

        // Lazy auto-complete: If leaf is APPROVED and endDate has passed, mark as COMPLETED
        const now = new Date();
        const enriched = await Promise.all(
            leaves.map(async (leave: any) => {
                if (leave.status === "APPROVED" && new Date(leave.endDate) < now) {
                    await prisma.leave.update({ where: { id: leave.id }, data: { status: "COMPLETED", completedAt: now } });
                    leave.status = "COMPLETED";
                }

                let employeeName = "Unknown";
                let profileImage = "user-08.jpg";
                let email = "";
                if (leave.employeeType === "DOCTOR") {
                    const doc = await prisma.doctor.findUnique({ where: { id: leave.employeeId }, select: { fullName: true, profileImage: true, email: true } });
                    if (doc) { employeeName = doc.fullName; profileImage = doc.profileImage || "user-08.jpg"; email = doc.email || ""; }
                } else {
                    const st = await prisma.staff.findUnique({ where: { id: leave.employeeId }, select: { fullName: true, profileImage: true, email: true } });
                    if (st) { employeeName = st.fullName; profileImage = st.profileImage || "user-05.jpg"; email = st.email || ""; }
                }
                return { ...leave, employeeName, profileImage, email };
            })
        );

        res.json(enriched);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/leaves/:id/status — Admin lifecycle management
export const updateLeaveStatus = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId as string;
        if (!clinicId) return res.status(403).json({ message: "Unauthorized" });

        const { id } = req.params;
        const { status, startDate, endDate, isPaid, rejectRemark, adminNotes } = req.body;

        const leave = await prisma.leave.findFirst({ where: { id, clinicId } });
        if (!leave) return res.status(404).json({ message: "Leave not found" });

        // Resolve employee email for notification
        let employeeEmail = "";
        if (leave.employeeType === "DOCTOR") {
            const doc = await prisma.doctor.findUnique({ where: { id: leave.employeeId }, select: { email: true } });
            employeeEmail = doc?.email || "";
        } else {
            const st = await prisma.staff.findUnique({ where: { id: leave.employeeId }, select: { email: true } });
            employeeEmail = st?.email || "";
        }

        const oldStatus = leave.status;
        const updateData: any = { status };

        if (status === "APPROVED") {
            if (startDate) updateData.startDate = new Date(startDate);
            if (endDate) updateData.endDate = new Date(endDate);
            if (isPaid !== undefined) updateData.isPaid = isPaid;
            if (adminNotes) updateData.adminNotes = adminNotes;

            // Recalculate working days if dates changed
            if (startDate || endDate) {
                updateData.workingDays = await calculateWorkingDays(
                    clinicId,
                    updateData.startDate || leave.startDate,
                    updateData.endDate || leave.endDate
                );
            }
        }

        if (status === "REJECTED") {
            updateData.rejectRemark = rejectRemark || "";
        }

        if (status === "CANCELLED") {
            updateData.cancelledAt = new Date();
        }

        const updatedLeave = await prisma.leave.update({ where: { id }, data: updateData });

        // Handle Attendance sync
        if (status === "APPROVED") {
            await syncAttendance(clinicId, updatedLeave);
        } else if ((status === "REJECTED" || status === "CANCELLED") && oldStatus === "APPROVED") {
            // Remove previous leave attendance if moving away from APPROVED
            await removeAttendance(clinicId, leave);
        }

        // Notify Employee
        if (employeeEmail) {
            await sendEmail(
                employeeEmail,
                `Leave Request ${status}`,
                `<h3>Your Leave Request Status Update</h3>
                 <p><b>Status:</b> ${status}</p>
                 <p><b>Dates:</b> ${updatedLeave.startDate.toLocaleDateString()} to ${updatedLeave.endDate.toLocaleDateString()}</p>
                 ${status === "REJECTED" ? `<p><b>Remark:</b> ${rejectRemark}</p>` : ""}
                 <p>Sign in to view details.</p>`
            );
        }

        res.json({ message: `Leave ${status.toLowerCase()} updated`, leave: updatedLeave });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/leaves/:id/withdraw — Employee withdraws before startDate
export const withdrawLeave = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId as string;
        if (!clinicId) return res.status(403).json({ message: "Unauthorized" });
        const { id } = req.params;

        const leave = await prisma.leave.findFirst({ where: { id, clinicId } });
        if (!leave) return res.status(404).json({ message: "Leave not found" });

        // Validation: Must be before start date
        if (new Date() >= new Date(leave.startDate)) {
            return res.status(400).json({ message: "Cannot withdraw leave after it has started. Use 'Complete' or contact admin." });
        }

        const updated = await prisma.leave.update({
            where: { id },
            data: { status: "WITHDRAWN", withdrawnAt: new Date() }
        });

        // Notify Admin
        const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { ownerEmail: true } });
        if (clinic?.ownerEmail) {
            await sendEmail(
                clinic.ownerEmail,
                `Leave Withdrawn - ${req.user?.fullName}`,
                `<p>Employee <b>${req.user?.fullName}</b> has withdrawn their leave request for ${leave.startDate.toLocaleDateString()}.</p>`
            );
        }

        res.json({ message: "Leave withdrawn", leave: updated });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// Helper: Sync attendance records
async function syncAttendance(clinicId: string, leave: any) {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    const current = new Date(start);

    while (current <= end) {
        const dayDate = new Date(current);
        const existing = await prisma.attendance.findFirst({
            where: { clinicId, employeeId: leave.employeeId, employeeType: leave.employeeType, date: dayDate },
        });

        if (existing) {
            await prisma.attendance.update({ where: { id: existing.id }, data: { status: "LEAVE" } });
        } else {
            await prisma.attendance.create({
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
async function removeAttendance(clinicId: string, leave: any) {
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);
    await prisma.attendance.deleteMany({
        where: {
            clinicId,
            employeeId: leave.employeeId,
            employeeType: leave.employeeType,
            date: { gte: start, lte: end },
            status: "LEAVE"
        }
    });
}

export const deleteLeave = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId as string;
        const { id } = req.params;
        await prisma.leave.deleteMany({ where: { id, clinicId: clinicId || undefined, status: "APPLIED" } });
        res.json({ message: "Leave deleted" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
