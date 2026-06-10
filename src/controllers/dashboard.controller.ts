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

        // 1. Monthly Stats (Last 12 Months)
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

        const monthlyAppointments = await prisma.appointment.findMany({
            where: {
                clinicId,
                scheduledAt: { gte: twelveMonthsAgo }
            },
            select: { scheduledAt: true, status: true }
        });

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyData = Array.from({ length: 12 }).map((_, i) => {
            const date = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
            const monthLabel = monthNames[date.getMonth()];
            const year = date.getFullYear();

            const monthApps = monthlyAppointments.filter(a => {
                const d = new Date(a.scheduledAt);
                return d.getMonth() === date.getMonth() && d.getFullYear() === year;
            });

            return {
                month: monthLabel,
                completed: monthApps.filter(a => a.status === 'Completed').length,
                ongoing: monthApps.filter(a => ['Schedule', 'Confirmed', 'Checked In'].includes(a.status)).length,
                rescheduled: monthApps.filter(a => a.status === 'Rescheduled').length
            };
        });

        // 2. Top 3 Departments
        const topDeptsRaw = await prisma.department.findMany({
            where: { clinicId },
            include: {
                _count: { select: { appointments: true } },
                appointments: { distinct: ['patientId'] } // Not exactly accurate but count of unique patients is better
            },
            take: 10 // Get some to sort
        });

        const topDepartments = topDeptsRaw
            .map(d => ({
                name: d.name,
                patientCount: d._count.appointments // Using appointment count as simplified proxy
            }))
            .sort((a, b) => b.patientCount - a.patientCount)
            .slice(0, 3);

        // 3. Income by Treatment (Department)
        const incomeByDepts = await prisma.department.findMany({
            where: { clinicId },
            include: {
                services: {
                    include: {
                        invoiceItems: {
                            include: { invoice: true }
                        }
                    }
                },
                _count: { select: { appointments: true } }
            }
        });

        const incomeByTreatment = incomeByDepts.map(dept => {
            let totalIncome = 0;
            dept.services.forEach(s => {
                s.invoiceItems.forEach(item => {
                    if (item.invoice.paymentStatus === 'Paid') {
                        totalIncome += item.amount;
                    }
                });
            });

            return {
                name: dept.name,
                income: totalIncome,
                appointmentCount: dept._count.appointments
            };
        }).sort((a, b) => b.income - a.income).slice(0, 5);

        const invoices = await prisma.invoice.findMany({
            where: { clinicId },
            select: { totalAmount: true }
        });
        const revenue = invoices.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);

        // Income = Paid invoices only
        const paidInvoices = await prisma.invoice.findMany({
            where: { clinicId, paymentStatus: 'Paid' },
            select: { totalAmount: true }
        });
        const totalIncome = paidInvoices.reduce((acc, curr) => acc + (Number(curr.totalAmount) || 0), 0);

        // Expenses = All expenses
        const allExpenses = await prisma.expense.findMany({
            where: { clinicId },
            select: { amount: true }
        });
        const totalExpense = allExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

        const netProfit = totalIncome - totalExpense;

        const allAppointments = await prisma.appointment.findMany({ where: { clinicId } });
        const completedApps = allAppointments.filter(app => app.status === 'Completed').length;
        const cancelledApps = allAppointments.filter(app => app.status === 'Cancelled').length;
        const rescheduledApps = allAppointments.filter(app => app.status === 'Rescheduled').length;

        const clinicInfo = await prisma.clinic.findUnique({
            where: { id: clinicId },
            include: { landingPage: true }
        });

        let profileCompletion = 0;
        if (clinicInfo) {
            let filledFields = 0;
            const totalFields = 15;
            if (clinicInfo.name) filledFields++;
            if (clinicInfo.ownerName) filledFields++;
            if (clinicInfo.ownerEmail) filledFields++;
            if (clinicInfo.phone || clinicInfo.whatsappNumber) filledFields++;
            if (clinicInfo.addressLine1) filledFields++;
            if (clinicInfo.city) filledFields++;
            if (clinicInfo.gstNumber) filledFields++;
            if (clinicInfo.emergencyContact) filledFields++;
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

        // 4. Top Patients (by total paid and appointment counts)
        const patientsRaw = await prisma.patient.findMany({
            where: { clinicId },
            include: {
                invoices: {
                    where: { paymentStatus: 'Paid' },
                    select: { totalAmount: true }
                },
                _count: { select: { appointments: true } }
            },
            take: 10
        });

        const topPatients = patientsRaw.map(p => ({
            id: p.id,
            fullName: `${p.firstName} ${p.lastName}`,
            profileImage: p.profileImage,
            totalPaid: p.invoices.reduce((acc, curr) => acc + curr.totalAmount, 0),
            appointmentCount: p._count.appointments
        })).sort((a, b) => b.totalPaid - a.totalPaid).slice(0, 5);

        // 5. Recent Transactions (Income invoices + Expenses combined)
        const recentInvoicesFull = await prisma.invoice.findMany({
            where: { clinicId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { patient: true }
        });

        const recentExpensesFull = await prisma.expense.findMany({
            where: { clinicId },
            orderBy: { date: 'desc' },
            take: 10
        });

        const incomeEntries = recentInvoicesFull.map(inv => ({
            id: inv.id,
            type: 'income' as const,
            description: `${inv.patient.firstName} ${inv.patient.lastName}`,
            invoiceCode: inv.invoiceCode,
            amount: Number(inv.totalAmount),
            status: inv.paymentStatus,
            method: inv.paymentMethod,
            date: inv.createdAt
        }));

        const expenseEntries = recentExpensesFull.map(exp => ({
            id: exp.id,
            type: 'expense' as const,
            description: exp.name,
            invoiceCode: exp.category || 'Expense',
            amount: Number(exp.amount),
            status: exp.status || 'Paid',
            method: exp.paymentMethod,
            date: exp.date
        }));

        const recentTransactions = [...incomeEntries, ...expenseEntries]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .slice(0, 10);

        // 6. Recent Appointments
        const recentAppointments = await prisma.appointment.findMany({
            where: { clinicId },
            orderBy: { scheduledAt: 'desc' },
            take: 5,
            include: {
                doctor: true,
                patient: true,
                department: true
            }
        });

        res.json({
            doctorsCount,
            patientsCount,
            appointmentsCount,
            revenue,
            totalIncome,
            totalExpense,
            netProfit,
            appointmentStats: {
                total: allAppointments.length,
                completed: completedApps,
                cancelled: cancelledApps,
                rescheduled: rescheduledApps
            },
            recentAppointments: recentAppointments.map(app => ({
                id: app.id,
                doctor: { fullName: app.doctor.fullName, profileImage: app.doctor.profileImage },
                patient: { firstName: app.patient.firstName, lastName: app.patient.lastName, phone: app.patient.phone },
                department: { name: app.department?.name },
                scheduledAt: app.scheduledAt,
                status: app.status,
                mode: app.mode
            })),
            monthlyData,
            topDepartments,
            incomeByTreatment,
            topPatients,
            recentTransactions,
            profileCompletion
        });
    } catch (error) {
        console.error('Get Dashboard Stats Error:', error);
        res.status(500).json({ message: 'Failed to retrieve dashboard stats' });
    }
};
