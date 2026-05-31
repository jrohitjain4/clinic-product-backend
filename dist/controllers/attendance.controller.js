"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyTodayStatus = exports.markSelfAttendance = exports.markAttendance = exports.getAttendance = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/attendance
const getAttendance = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { month, year } = req.query;
        if (!month || !year) {
            return res.status(400).json({ message: "Month and Year are required" });
        }
        const numericMonth = parseInt(month, 10);
        const numericYear = parseInt(year, 10);
        // Calculate start and end date of the month
        const startDate = new Date(numericYear, numericMonth - 1, 1);
        const endDate = new Date(numericYear, numericMonth, 0);
        // Fetch Doctors
        const doctors = await prisma_1.default.doctor.findMany({
            where: { clinicId },
            select: { id: true, fullName: true, profileImage: true }
        });
        // Fetch Staffs
        const staffs = await prisma_1.default.staff.findMany({
            where: { clinicId },
            select: { id: true, fullName: true, profileImage: true }
        });
        // Fetch Attendances for the month
        const attendances = await prisma_1.default.attendance.findMany({
            where: {
                clinicId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });
        // Fetch Holidays (if any exist for the month)
        // Here we assume holidays don't have year explicitly bound if recurring,
        // but for now let's just query holidays within the date range.
        const holidays = await prisma_1.default.holiday.findMany({
            where: {
                clinicId,
                date: {
                    gte: startDate,
                    lte: endDate
                }
            }
        });
        // Map into a uniform list of employees with their attendance records
        const employees = [
            ...doctors.map((d) => ({ ...d, type: 'DOCTOR' })),
            ...staffs.map((s) => ({ ...s, type: 'STAFF' }))
        ];
        const daysInMonth = endDate.getDate();
        const formattedData = employees.map((emp) => {
            const empAttendance = attendances.filter((a) => a.employeeId === emp.id && a.employeeType === emp.type);
            const attendanceMap = {};
            for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(numericYear, numericMonth - 1, day);
                // Check attendance record
                const record = empAttendance.find((a) => {
                    const aDate = new Date(a.date);
                    return aDate.getDate() === Math.floor(day) && aDate.getMonth() === (numericMonth - 1) && aDate.getFullYear() === numericYear;
                });
                if (record && record.status) {
                    attendanceMap[day] = record.status;
                }
                else {
                    // Check if day falls within any holiday range
                    const currentDate = new Date(numericYear, numericMonth - 1, day);
                    const isHoliday = holidays.some((h) => {
                        const hStart = new Date(h.date);
                        hStart.setHours(0, 0, 0, 0);
                        const hEnd = h.endDate ? new Date(h.endDate) : new Date(hStart);
                        hEnd.setHours(23, 59, 59, 999);
                        return currentDate >= hStart && currentDate <= hEnd;
                    });
                    if (isHoliday) {
                        attendanceMap[day] = 'HOLIDAY';
                    }
                    else {
                        attendanceMap[day] = ''; // No record
                    }
                }
            }
            // Calculate percentage
            const totalWorkingDays = daysInMonth - holidays.length;
            const presentDays = empAttendance.filter((a) => a.status === 'PRESENT' || a.status === 'HALF_DAY').length; // Treating half day as partial or present for now
            const percentage = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;
            return {
                id: emp.id,
                name: emp.fullName,
                type: emp.type,
                img: emp.profileImage || (emp.type === 'DOCTOR' ? "user-08.jpg" : "user-05.jpg"),
                percentage: `${percentage}%`,
                attendance: attendanceMap
            };
        });
        res.json(formattedData);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getAttendance = getAttendance;
// POST /api/attendance/mark
const markAttendance = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { employeeId, employeeType, date, status } = req.body;
        if (!employeeId || !employeeType || !date || status === undefined) {
            return res.status(400).json({ message: "Invalid payload" });
        }
        const markDate = new Date(date);
        const existing = await prisma_1.default.attendance.findFirst({
            where: {
                clinicId,
                employeeId,
                employeeType,
                date: markDate
            }
        });
        // If status is empty, it means 'Clear Attendance'
        if (status === "" || status === null) {
            if (existing) {
                await prisma_1.default.attendance.delete({
                    where: { id: existing.id }
                });
                return res.json({ message: "Attendance cleared" });
            }
            return res.json({ message: "No attendance to clear" });
        }
        if (existing) {
            // Update
            const updated = await prisma_1.default.attendance.update({
                where: { id: existing.id },
                data: { status, markedBy: 'ADMIN' }
            });
            return res.json(updated);
        }
        else {
            // Create
            const created = await prisma_1.default.attendance.create({
                data: {
                    clinicId,
                    employeeId,
                    employeeType,
                    date: markDate,
                    status,
                    markedBy: 'ADMIN'
                }
            });
            return res.status(201).json(created);
        }
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.markAttendance = markAttendance;
// POST /api/attendance/mark-self
const markSelfAttendance = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const userEmail = req.user?.email;
        const role = req.user?.role;
        if (!clinicId || !userEmail)
            return res.status(403).json({ message: "Unauthorized" });
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
        // Set date to today without time for consistent checking
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existing = await prisma_1.default.attendance.findFirst({
            where: {
                clinicId,
                employeeId,
                employeeType,
                date: today
            }
        });
        if (existing) {
            if (existing.status === 'PRESENT') {
                return res.status(200).json({ message: "Attendance already marked for today.", updated: false, data: existing });
            }
            const updated = await prisma_1.default.attendance.update({
                where: { id: existing.id },
                data: { status: 'PRESENT', markedBy: 'SELF' }
            });
            return res.json({ message: "Attendance updated to Present.", data: updated, updated: true });
        }
        else {
            const created = await prisma_1.default.attendance.create({
                data: {
                    clinicId,
                    employeeId,
                    employeeType,
                    date: today,
                    status: 'PRESENT',
                    markedBy: 'SELF'
                }
            });
            return res.status(201).json({ message: "Attendance marked for today successfully.", data: created, created: true });
        }
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.markSelfAttendance = markSelfAttendance;
// GET /api/attendance/today-status
const getMyTodayStatus = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const userEmail = req.user?.email;
        const role = req.user?.role;
        if (!clinicId || !userEmail)
            return res.status(403).json({ message: "Unauthorized" });
        let employeeId;
        let employeeType;
        if (role === "DOCTOR") {
            const doctor = await prisma_1.default.doctor.findFirst({ where: { email: userEmail, clinicId } });
            if (!doctor)
                return res.status(404).json({ message: "Doctor profile not found." });
            employeeId = doctor.id;
            employeeType = "DOCTOR";
        }
        else {
            const staff = await prisma_1.default.staff.findFirst({ where: { email: userEmail, clinicId } });
            if (!staff)
                return res.status(404).json({ message: "Staff profile not found." });
            employeeId = staff.id;
            employeeType = "STAFF";
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const existing = await prisma_1.default.attendance.findFirst({
            where: {
                clinicId,
                employeeId,
                employeeType,
                date: today
            }
        });
        if (existing) {
            return res.json(existing);
        }
        else {
            return res.json({ status: null });
        }
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getMyTodayStatus = getMyTodayStatus;
