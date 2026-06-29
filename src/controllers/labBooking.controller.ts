import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

const ensureLabBookingInvoice = async (bookingId: string, clinicId: string) => {
    try {
        const booking = await prisma.labBooking.findUnique({
            where: { id: bookingId },
            include: {
                patient: true,
                test: true,
                invoice: true,
            }
        });

        if (!booking || booking.status !== "Confirmed" || booking.invoice) return;
        if (!booking.patient || !booking.test) return;

        const fee = booking.test.price || 0;
        if (fee <= 0) return;

        const invStatus = "Paid";

        await prisma.invoice.create({
            data: {
                clinicId,
                patientId: booking.patientId,
                labBookingId: booking.id,
                invoiceDate: new Date(),
                dueDate: new Date(),
                subTotal: fee,
                totalAmount: fee,
                paymentStatus: invStatus,
                paymentMethod: booking.paymentMethod || "Cash",
                invoiceCode: `INV-AUTO-${booking.bookingCode || Date.now()}`,
                items: {
                    create: [{
                        clinicId,
                        description: `Lab Test: ${booking.test.name}`,
                        quantity: 1,
                        unitCost: fee,
                        amount: fee,
                    }]
                }
            }
        });

        // Update the lab booking itself so the diagnostic invoice page reflects it as Paid
        await prisma.labBooking.update({
            where: { id: booking.id },
            data: { paymentStatus: invStatus }
        });
    } catch (err) {
        console.error("Auto-invoice for LabBooking failed:", err);
    }
};

// GET /api/lab-bookings
export const getLabBookings = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const bookings = await prisma.labBooking.findMany({
            where: { clinicId },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
                test: {
                    select: {
                        id: true, name: true, price: true, testCode: true,
                        assignedDoctors: true,
                        category: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        let filteredBookings = bookings;
        if (req.user?.role === "DOCTOR" && req.user?.doctorId) {
            const docId = req.user.doctorId;
            const userId = req.user.id;
            filteredBookings = bookings.filter(b => {
                return b.assignedUserId === docId || b.assignedUserId === userId;
            });
        } else if (req.user?.role === "PATIENT" && req.user?.patientId) {
            const patientId = req.user.patientId;
            filteredBookings = bookings.filter(b => b.patientId === patientId);
        }

        res.json(filteredBookings);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/lab-bookings
export const createLabBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { patientId, testId, scheduledAt, status, paymentStatus, paymentMethod, discount, tax, totalAmount, sessionSlot, assignedUserId, remarks } = req.body;

        if (!patientId) return res.status(400).json({ message: "Patient is required" });
        if (!testId) return res.status(400).json({ message: "Test is required" });
        if (!scheduledAt) return res.status(400).json({ message: "Scheduled date is required" });

        // Auto-generate booking code
        const count = await prisma.labBooking.count({ where: { clinicId } });
        const bookingCode = `LB${String(count + 1).padStart(4, "0")}`;

        // Auto-generate invoice number
        const invoiceNo = `LINV-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

        const booking = await prisma.labBooking.create({
            data: {
                bookingCode,
                patientId,
                testId,
                scheduledAt: new Date(scheduledAt),
                status: status || "Pending",
                paymentStatus: paymentStatus || "Unpaid",
                paymentMethod: paymentMethod || null,
                discount: parseFloat(discount) || 0,
                tax: parseFloat(tax) || 0,
                totalAmount: parseFloat(totalAmount) || 0,
                invoiceNo,
                sessionSlot: sessionSlot || null,
                assignedUserId: assignedUserId || null,
                remarks: remarks || null,
                clinicId,
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
                test: {
                    select: {
                        id: true, name: true, price: true, testCode: true,
                        category: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (booking.status === "Confirmed") {
            await ensureLabBookingInvoice(booking.id, clinicId);
        }

        res.status(201).json(booking);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/lab-bookings/:id
export const updateLabBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });
        const { id } = req.params;

        const existing = await prisma.labBooking.findFirst({ where: { id, clinicId } });
        if (!existing) return res.status(404).json({ message: "Booking not found" });

        const { status, paymentStatus, paymentMethod, discount, tax, totalAmount, scheduledAt, sessionSlot, assignedUserId, remarks } = req.body;

        const updated = await prisma.labBooking.update({
            where: { id },
            data: {
                ...(status !== undefined && { status }),
                ...(paymentStatus !== undefined && { paymentStatus }),
                ...(paymentMethod !== undefined && { paymentMethod }),
                ...(discount !== undefined && { discount: parseFloat(discount) }),
                ...(tax !== undefined && { tax: parseFloat(tax) }),
                ...(totalAmount !== undefined && { totalAmount: parseFloat(totalAmount) }),
                ...(scheduledAt !== undefined && { scheduledAt: new Date(scheduledAt) }),
                ...(sessionSlot !== undefined && { sessionSlot }),
                ...(assignedUserId !== undefined && { assignedUserId }),
                ...(remarks !== undefined && { remarks }),
            },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
                test: {
                    select: {
                        id: true, name: true, price: true, testCode: true,
                        category: { select: { id: true, name: true } },
                    },
                },
            },
        });

        if (updated.status === "Confirmed") {
            await ensureLabBookingInvoice(updated.id, clinicId);
        }

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/lab-bookings/:id
export const deleteLabBooking = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });
        const { id } = req.params;

        const existing = await prisma.labBooking.findFirst({ where: { id, clinicId } });
        if (!existing) return res.status(404).json({ message: "Booking not found" });

        await prisma.labBooking.delete({ where: { id } });
        res.json({ message: "Booking deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/lab-bookings/bulk
export const bulkDeleteLabBookings = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "ids array is required" });
        }

        await prisma.labBooking.deleteMany({
            where: { id: { in: ids }, clinicId },
        });

        res.json({ message: `${ids.length} bookings deleted successfully` });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/lab-bookings/dashboard
export const getLabDashboard = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const [
            totalBookings,
            todaysBookings,
            pendingBookings,
            confirmedBookings,
            completedBookings,
            cancelledBookings,
            todaysRevenueAgg,
            totalRevenueAgg,
            recentBookings,
            categoryStats,
        ] = await Promise.all([
            prisma.labBooking.count({ where: { clinicId } }),
            prisma.labBooking.count({
                where: { clinicId, scheduledAt: { gte: todayStart, lte: todayEnd } },
            }),
            prisma.labBooking.count({ where: { clinicId, status: "Pending" } }),
            prisma.labBooking.count({ where: { clinicId, status: "Confirmed" } }),
            prisma.labBooking.count({ where: { clinicId, status: "Completed" } }),
            prisma.labBooking.count({ where: { clinicId, status: "Cancelled" } }),
            // Today's Revenue: Invoices paid today for lab bookings
            prisma.invoice.aggregate({
                where: {
                    clinicId,
                    labBookingId: { not: null },
                    createdAt: { gte: todayStart, lte: todayEnd },
                    paymentStatus: "Paid",
                },
                _sum: { totalAmount: true },
            }),
            // Total Revenue: All paid invoices for lab bookings
            prisma.invoice.aggregate({
                where: {
                    clinicId,
                    labBookingId: { not: null },
                    paymentStatus: "Paid",
                },
                _sum: { totalAmount: true },
            }),
            prisma.labBooking.findMany({
                where: { clinicId, scheduledAt: { gte: todayStart } },
                include: {
                    patient: { select: { firstName: true, lastName: true, patientCode: true } },
                    test: { select: { name: true, category: { select: { name: true } } } },
                },
                orderBy: { scheduledAt: "asc" },
                take: 10,
            }),
            prisma.labCategory.findMany({
                where: { clinicId },
                select: {
                    name: true,
                    _count: { select: { tests: true } },
                },
            }),
        ]);

        res.json({
            totalBookings,
            todaysBookings,
            pendingBookings,
            confirmedBookings,
            completedBookings,
            cancelledBookings,
            todaysRevenue: todaysRevenueAgg._sum.totalAmount || 0,
            totalRevenue: totalRevenueAgg._sum.totalAmount || 0,
            recentBookings,
            categoryStats,
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
