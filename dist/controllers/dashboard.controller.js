"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardStats = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getDashboardStats = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }
        const doctorsCount = await prisma_1.default.doctor.count({ where: { clinicId } });
        const patientsCount = await prisma_1.default.patient.count({ where: { clinicId } });
        const appointmentsCount = await prisma_1.default.appointment.count({ where: { clinicId } });
        const invoices = await prisma_1.default.invoice.findMany({
            where: { clinicId },
            select: { totalAmount: true }
        });
        const revenue = invoices.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);
        // Appointment stats for the chart (grouped by status)
        const allAppointments = await prisma_1.default.appointment.findMany({ where: { clinicId } });
        const completedAppointments = allAppointments.filter(app => app.status === 'Completed').length;
        const cancelledAppointments = allAppointments.filter(app => app.status === 'Cancelled').length;
        const rescheduledAppointments = allAppointments.filter(app => app.status === 'Rescheduled').length;
        res.json({
            doctorsCount,
            patientsCount,
            appointmentsCount,
            revenue,
            appointmentStats: {
                total: allAppointments.length,
                completed: completedAppointments,
                cancelled: cancelledAppointments,
                rescheduled: rescheduledAppointments
            }
        });
    }
    catch (error) {
        console.error('Get Dashboard Stats Error:', error);
        res.status(500).json({ message: 'Failed to retrieve dashboard stats' });
    }
};
exports.getDashboardStats = getDashboardStats;
