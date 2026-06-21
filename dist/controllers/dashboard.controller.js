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
        const patientsCount = await prisma_1.default.patient.count({
            where: {
                clinicId,
                status: { not: "Deleted" }
            }
        });
        const appointmentsCount = await prisma_1.default.appointment.count({ where: { clinicId } });
        // 1. Monthly Stats (Last 12 Months)
        const now = new Date();
        const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const monthlyAppointments = await prisma_1.default.appointment.findMany({
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
        const topDeptsRaw = await prisma_1.default.department.findMany({
            where: { clinicId },
            include: {
                _count: { select: { appointments: true } }
            }
        });
        const topDepartments = topDeptsRaw
            .map(d => ({
            name: d.name,
            patientCount: d._count.appointments
        }))
            .sort((a, b) => b.patientCount - a.patientCount)
            .slice(0, 3);
        // 3. Income by Treatment (Department) - highly optimized using selects
        const incomeByDepts = await prisma_1.default.department.findMany({
            where: { clinicId },
            select: {
                id: true,
                name: true,
                _count: { select: { appointments: true } },
                services: {
                    select: {
                        invoiceItems: {
                            where: {
                                invoice: { paymentStatus: 'Paid' }
                            },
                            select: {
                                amount: true
                            }
                        }
                    }
                }
            }
        });
        const incomeByTreatment = incomeByDepts.map(dept => {
            let totalIncomeVal = 0;
            dept.services.forEach(s => {
                s.invoiceItems.forEach(item => {
                    totalIncomeVal += item.amount;
                });
            });
            return {
                name: dept.name,
                income: totalIncomeVal,
                appointmentCount: dept._count.appointments
            };
        }).sort((a, b) => b.income - a.income).slice(0, 5);
        // Revenue = Sum of all invoice totalAmount
        const revenueAgg = await prisma_1.default.invoice.aggregate({
            where: { clinicId },
            _sum: { totalAmount: true }
        });
        const revenue = revenueAgg._sum.totalAmount || 0;
        // Income = Sum of paid invoice totalAmount
        const incomeAgg = await prisma_1.default.invoice.aggregate({
            where: { clinicId, paymentStatus: 'Paid' },
            _sum: { totalAmount: true }
        });
        const totalIncome = incomeAgg._sum.totalAmount || 0;
        // Expenses = Sum of all expense amounts
        const expenseAgg = await prisma_1.default.expense.aggregate({
            where: { clinicId },
            _sum: { amount: true }
        });
        const totalExpense = expenseAgg._sum.amount || 0;
        const netProfit = totalIncome - totalExpense;
        // Count appointment statuses using groupBy
        const appointmentCounts = await prisma_1.default.appointment.groupBy({
            by: ['status'],
            where: { clinicId },
            _count: { _all: true }
        });
        let completedApps = 0;
        let cancelledApps = 0;
        let rescheduledApps = 0;
        appointmentCounts.forEach(c => {
            if (c.status === 'Completed')
                completedApps = c._count._all;
            if (c.status === 'Cancelled')
                cancelledApps = c._count._all;
            if (c.status === 'Rescheduled')
                rescheduledApps = c._count._all;
        });
        const clinicInfo = await prisma_1.default.clinic.findUnique({
            where: { id: clinicId },
            include: { landingPage: true }
        });
        let profileCompletion = 0;
        if (clinicInfo) {
            let filledFields = 0;
            const totalFields = 15;
            if (clinicInfo.name)
                filledFields++;
            if (clinicInfo.ownerName)
                filledFields++;
            if (clinicInfo.ownerEmail)
                filledFields++;
            if (clinicInfo.phone || clinicInfo.whatsappNumber)
                filledFields++;
            if (clinicInfo.addressLine1)
                filledFields++;
            if (clinicInfo.city)
                filledFields++;
            if (clinicInfo.gstNumber)
                filledFields++;
            if (clinicInfo.emergencyContact)
                filledFields++;
            const lp = clinicInfo.landingPage;
            if (lp) {
                if (lp.tagline)
                    filledFields++;
                if (lp.logo)
                    filledFields++;
                if (lp.headerImage)
                    filledFields++;
                if (lp.about)
                    filledFields++;
                if (lp.established)
                    filledFields++;
                if (lp.timetable && lp.timetable !== "{}")
                    filledFields++;
                if (lp.gallery && lp.gallery.length > 0)
                    filledFields++;
            }
            profileCompletion = Math.round((filledFields / totalFields) * 100);
        }
        // 4. Top Patients (by total paid and appointment counts) - highly optimized
        const topPayingInvoices = await prisma_1.default.invoice.groupBy({
            by: ['patientId'],
            where: {
                clinicId,
                paymentStatus: 'Paid',
                patientId: { not: null }
            },
            _sum: {
                totalAmount: true
            },
            orderBy: {
                _sum: {
                    totalAmount: 'desc'
                }
            },
            take: 5
        });
        const topPatientIds = topPayingInvoices.map(item => item.patientId);
        let topPatients = [];
        if (topPatientIds.length > 0) {
            const patientsDetails = await prisma_1.default.patient.findMany({
                where: {
                    id: { in: topPatientIds },
                    status: { not: 'Deleted' }
                },
                include: {
                    _count: { select: { appointments: true } }
                }
            });
            topPatients = topPayingInvoices.map(ti => {
                const p = patientsDetails.find(pt => pt.id === ti.patientId);
                return {
                    id: p?.id || ti.patientId || '',
                    fullName: p ? `${p.firstName} ${p.lastName}` : 'Unknown Patient',
                    profileImage: p?.profileImage || null,
                    totalPaid: ti._sum.totalAmount || 0,
                    appointmentCount: p?._count.appointments || 0
                };
            }).filter(p => p.id !== '');
        }
        if (topPatients.length < 5) {
            const existingIds = topPatients.map(p => p.id);
            const fallbackPatients = await prisma_1.default.patient.findMany({
                where: {
                    clinicId,
                    status: { not: 'Deleted' },
                    id: { notIn: existingIds }
                },
                include: {
                    invoices: {
                        where: { paymentStatus: 'Paid' },
                        select: { totalAmount: true }
                    },
                    _count: { select: { appointments: true } }
                },
                take: 5 - topPatients.length
            });
            const mappedFallback = fallbackPatients.map(p => ({
                id: p.id,
                fullName: `${p.firstName} ${p.lastName}`,
                profileImage: p.profileImage,
                totalPaid: p.invoices.reduce((acc, curr) => acc + curr.totalAmount, 0),
                appointmentCount: p._count.appointments
            }));
            topPatients = [...topPatients, ...mappedFallback];
        }
        // 5. Recent Transactions (Income invoices + Expenses combined)
        const recentInvoicesFull = await prisma_1.default.invoice.findMany({
            where: { clinicId },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true,
                invoiceCode: true,
                totalAmount: true,
                paymentStatus: true,
                paymentMethod: true,
                createdAt: true,
                patient: {
                    select: {
                        firstName: true,
                        lastName: true
                    }
                }
            }
        });
        const recentExpensesFull = await prisma_1.default.expense.findMany({
            where: { clinicId },
            orderBy: { date: 'desc' },
            take: 10,
            select: {
                id: true,
                name: true,
                category: true,
                amount: true,
                status: true,
                paymentMethod: true,
                date: true
            }
        });
        const incomeEntries = recentInvoicesFull.map(inv => ({
            id: inv.id,
            type: 'income',
            description: inv.patient ? `${inv.patient.firstName} ${inv.patient.lastName}` : 'Unknown Patient',
            invoiceCode: inv.invoiceCode,
            amount: Number(inv.totalAmount),
            status: inv.paymentStatus,
            method: inv.paymentMethod,
            date: inv.createdAt
        }));
        const expenseEntries = recentExpensesFull.map(exp => ({
            id: exp.id,
            type: 'expense',
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
        const recentAppointments = await prisma_1.default.appointment.findMany({
            where: { clinicId },
            orderBy: { scheduledAt: 'desc' },
            take: 5,
            select: {
                id: true,
                scheduledAt: true,
                status: true,
                mode: true,
                doctor: {
                    select: {
                        fullName: true,
                        profileImage: true
                    }
                },
                patient: {
                    select: {
                        firstName: true,
                        lastName: true,
                        phone: true
                    }
                },
                department: {
                    select: {
                        name: true
                    }
                }
            }
        });
        // 7. Revenue Breakdown
        const invoiceItems = await prisma_1.default.invoiceItem.findMany({
            where: {
                invoice: { clinicId, paymentStatus: 'Paid' }
            },
            select: {
                amount: true,
                serviceId: true,
                service: {
                    select: {
                        serviceName: true,
                        department: {
                            select: { name: true }
                        }
                    }
                }
            }
        });
        const discountAgg = await prisma_1.default.invoice.aggregate({
            where: { clinicId, paymentStatus: 'Paid' },
            _sum: { discount: true }
        });
        const discounts = discountAgg._sum.discount || 0;
        let consultation = 0;
        let procedures = 0;
        let products = 0;
        invoiceItems.forEach(item => {
            if (!item.serviceId) {
                products += Number(item.amount) || 0;
            }
            else {
                const sName = item.service?.serviceName?.toLowerCase() || '';
                const dName = item.service?.department?.name?.toLowerCase() || '';
                if (sName.includes('consultation') || sName.includes('opd') || dName.includes('consultation') || dName.includes('opd')) {
                    consultation += Number(item.amount) || 0;
                }
                else {
                    procedures += Number(item.amount) || 0;
                }
            }
        });
        // 8. Patient Stats
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newPatientsCount = await prisma_1.default.patient.count({
            where: {
                clinicId,
                status: { not: "Deleted" },
                createdAt: { gte: thirtyDaysAgo }
            }
        });
        const returningPatientsCount = await prisma_1.default.patient.count({
            where: {
                clinicId,
                status: { not: "Deleted" },
                createdAt: { lt: thirtyDaysAgo },
                appointments: { some: {} }
            }
        });
        const inactivePatientsCount = await prisma_1.default.patient.count({
            where: {
                clinicId,
                status: { not: "Deleted" },
                createdAt: { lt: thirtyDaysAgo },
                appointments: { none: {} }
            }
        });
        // 9. Staff Attendance Stats
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const todayAttendance = await prisma_1.default.attendance.findMany({
            where: {
                clinicId,
                date: {
                    gte: todayStart,
                    lt: todayEnd
                }
            },
            select: {
                status: true
            }
        });
        const totalStaff = await prisma_1.default.staff.count({ where: { clinicId } });
        const presentStaff = todayAttendance.filter(a => ['PRESENT', 'PRESENT_HALF_DAY', 'HALF_DAY'].includes(a.status.toUpperCase())).length;
        const absentStaff = todayAttendance.filter(a => a.status.toUpperCase() === 'ABSENT').length;
        // 10. Top Services utilized
        const topServicesRaw = await prisma_1.default.invoiceItem.groupBy({
            by: ['serviceId'],
            where: { clinicId, serviceId: { not: null } },
            _count: { serviceId: true },
            orderBy: {
                _count: {
                    serviceId: 'desc'
                }
            },
            take: 4
        });
        const topServicesIds = topServicesRaw.map(r => r.serviceId).filter(Boolean);
        const servicesDetails = await prisma_1.default.service.findMany({
            where: { id: { in: topServicesIds } }
        });
        const topServicesList = topServicesRaw.map(r => {
            const svc = servicesDetails.find(s => s.id === r.serviceId);
            return {
                name: svc?.serviceName || 'Unknown Service',
                count: r._count.serviceId,
                type: 'Service'
            };
        });
        const topProductsRaw = await prisma_1.default.invoiceItem.groupBy({
            by: ['description'],
            where: { clinicId, serviceId: null },
            _count: { description: true },
            orderBy: {
                _count: {
                    description: 'desc'
                }
            },
            take: 4
        });
        const topServicesCombined = [
            ...topServicesList,
            ...topProductsRaw.map(r => ({
                name: r.description || 'Medicine & Products',
                count: r._count.description,
                type: 'Product'
            }))
        ].sort((a, b) => b.count - a.count).slice(0, 4);
        res.json({
            doctorsCount,
            patientsCount,
            appointmentsCount,
            revenue,
            totalIncome,
            totalExpense,
            netProfit,
            appointmentStats: {
                total: appointmentsCount,
                completed: completedApps,
                cancelled: cancelledApps,
                rescheduled: rescheduledApps
            },
            recentAppointments: recentAppointments.map(app => ({
                id: app.id,
                doctor: app.doctor ? { fullName: app.doctor.fullName, profileImage: app.doctor.profileImage } : { fullName: 'Unknown Doctor', profileImage: null },
                patient: app.patient ? { firstName: app.patient.firstName, lastName: app.patient.lastName, phone: app.patient.phone } : { firstName: 'Unknown', lastName: 'Patient', phone: null },
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
            profileCompletion,
            revenueBreakdown: {
                consultation,
                procedures,
                products,
                discounts
            },
            patientStats: {
                newCount: newPatientsCount,
                returningCount: returningPatientsCount,
                inactiveCount: inactivePatientsCount
            },
            staffAttendance: {
                total: totalStaff,
                present: presentStaff,
                absent: absentStaff,
                percentage: totalStaff > 0 ? Math.round((presentStaff / totalStaff) * 100) : 0
            },
            topServices: topServicesCombined
        });
    }
    catch (error) {
        console.error('Get Dashboard Stats Error:', error);
        res.status(500).json({ message: 'Failed to retrieve dashboard stats' });
    }
};
exports.getDashboardStats = getDashboardStats;
