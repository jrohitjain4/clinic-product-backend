import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';

const prisma = new PrismaClient();

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

        res.json({
            totalRevenue,
            activeSubscriptions,
            totalClinics: clinics.length,
            pendingRenewals: clinics.filter(c => c.status === 'TRIAL_EXPIRED').length,
            transactionHistory: transactions
        });
    } catch (error) {
        console.error('Super Admin Analytics Error:', error);
        res.status(500).json({ message: 'Failed to retrieve analytics' });
    }
};
