import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

export const getDashboardStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const doctorsCount = await prisma.doctor.count({ where: { clinicId } });
        const patientsCount = await prisma.patient.count({ where: { clinicId } });
        const appointmentsCount = await prisma.appointment.count({ where: { clinicId } });

        const invoices = await prisma.invoice.findMany({
            where: { clinicId },
            select: { totalAmount: true }
        });

        const revenue = invoices.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);

        // Appointment stats for the chart (grouped by status)
        const allAppointments = await prisma.appointment.findMany({ where: { clinicId } });
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
    } catch (error) {
        console.error('Get Dashboard Stats Error:', error);
        res.status(500).json({ message: 'Failed to retrieve dashboard stats' });
    }
};
