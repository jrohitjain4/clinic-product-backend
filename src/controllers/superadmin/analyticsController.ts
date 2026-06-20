import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import prisma from '../../lib/prisma';

export const getSuperAdminAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        if (req.user?.role !== 'SUPER_ADMIN') {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        const clinics = await prisma.clinic.findMany({
            include: { package: true }
        });

        const activeClinics = clinics.filter(c => c.status === 'UPGRADED' || c.status === 'IN_PROGRESS');
        const activeSubscriptions = clinics.filter(c => c.packageId).length;

        let totalRevenue = 0;
        let packageSales = 0;

        const transactions = clinics.filter(c => c.package).map(clinic => {
            const price = clinic.package!.price;
            totalRevenue += price;
            packageSales += 1;

            return {
                id: clinic.id,
                clinicName: clinic.name,
                amount: price,
                date: clinic.packageStartsAt || clinic.createdAt,
                packageInfo: clinic.package!.name,
                paymentMethod: 'Stripe', // Mock payment method
                status: 'Received'
            };
        });

        const freeTrials = clinics.filter(c => c.status === 'TRIAL' || c.status === 'IN_PROGRESS').length;
        const premiumPackages = clinics.filter(c => c.status === 'UPGRADED').length;
        const demoBookings = await prisma.demoBooking.count();
        const totalPackages = await prisma.subscriptionPackage.count();
        const totalTickets = await prisma.ticket.count();
        const openTickets = await prisma.ticket.count({ where: { status: 'Pending' } });

        const demoBookingsList = await prisma.demoBooking.findMany({ orderBy: { createdAt: 'desc' }, take: 4 });
        const packagesList = await prisma.subscriptionPackage.findMany({ orderBy: { createdAt: 'desc' }, take: 4 });
        const recentClinics = await prisma.clinic.findMany({ orderBy: { createdAt: 'desc' }, take: 4 });
        const ticketsList = await prisma.ticket.findMany({ orderBy: { createdAt: 'desc' }, take: 4 });

        const clinicStatusCounts = {
            UPGRADED: clinics.filter(c => c.status === 'UPGRADED').length,
            IN_PROGRESS: clinics.filter(c => c.status === 'IN_PROGRESS').length,
            TRIAL: clinics.filter(c => c.status === 'TRIAL').length,
            TRIAL_EXPIRED: clinics.filter(c => c.status === 'TRIAL_EXPIRED').length
        };

        res.json({
            totalRevenue,
            activeSubscriptions,
            totalClinics: clinics.length,
            pendingRenewals: clinics.filter(c => c.status === 'TRIAL_EXPIRED').length,
            transactionHistory: transactions,
            freeTrials,
            premiumPackages,
            demoBookings,
            totalPackages,
            totalTickets,
            openTickets,
            packagesList,
            demoBookingsList,
            recentClinics,
            ticketsList,
            clinicStatusCounts
        });
    } catch (error) {
        console.error('Super Admin Analytics Error:', error);
        res.status(500).json({ message: 'Failed to retrieve analytics' });
    }
};
