import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';

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

        const clinicInfo = await prisma.clinic.findUnique({
            where: { id: clinicId },
            include: { landingPage: true }
        });

        let profileCompletion = 0;
        if (clinicInfo) {
            let filledFields = 0;
            const totalFields = 15;

            // Clinic check
            if (clinicInfo.name) filledFields++;
            if (clinicInfo.ownerName) filledFields++;
            if (clinicInfo.ownerEmail) filledFields++;
            if (clinicInfo.phone || clinicInfo.whatsappNumber) filledFields++;
            if (clinicInfo.addressLine1) filledFields++;
            if (clinicInfo.city) filledFields++;
            if (clinicInfo.gstNumber) filledFields++;
            if (clinicInfo.emergencyContact) filledFields++;

            // LandingPage check
            const lp = clinicInfo.landingPage;
            if (lp) {
                if (lp.tagline) filledFields++;
                if (lp.logo) filledFields++;
                if (lp.headerImage) filledFields++;
                if (lp.about) filledFields++;
                if (lp.established) filledFields++;
                if (lp.timetable && (lp.timetable as string) !== "{}") filledFields++;
                if (lp.gallery && (lp.gallery as any[]).length > 0) filledFields++;
            }

            profileCompletion = Math.round((filledFields / totalFields) * 100);
        }

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
            },
            profileCompletion
        });
    } catch (error) {
        console.error('Get Dashboard Stats Error:', error);
        res.status(500).json({ message: 'Failed to retrieve dashboard stats' });
    }
};
