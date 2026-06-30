import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/pharmacy-invoices/dashboard
export const getPharmacyDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const [
            totalBills,
            paidBills,
            unpaidBills,
            todayBills,
            todayRevenue,
            totalRevenue,
            allMedicines,
            recentSales,
        ] = await Promise.all([
            prisma.pharmacyInvoice.count({ where: { clinicId } }),
            prisma.pharmacyInvoice.count({ where: { clinicId, paymentStatus: "Paid" } }),
            prisma.pharmacyInvoice.count({ where: { clinicId, paymentStatus: "Unpaid" } }),
            prisma.pharmacyInvoice.count({ where: { clinicId, invoiceDate: { gte: today, lte: todayEnd } } }),
            prisma.pharmacyInvoice.aggregate({
                where: { clinicId, paymentStatus: "Paid", invoiceDate: { gte: today, lte: todayEnd } },
                _sum: { totalAmount: true },
            }),
            prisma.pharmacyInvoice.aggregate({
                where: { clinicId, paymentStatus: "Paid" },
                _sum: { totalAmount: true },
            }),
            prisma.medicine.findMany({
                where: { clinicId, status: "Active" },
                select: {
                    id: true, medicineName: true, medicineCode: true,
                    openingStock: true, stockIn: true, stockOut: true,
                    minimumStockAlert: true, expiryDate: true,
                    category: { select: { name: true } },
                }
            }),
            prisma.pharmacyInvoice.findMany({
                where: { clinicId },
                orderBy: { createdAt: "desc" },
                take: 8,
                include: {
                    patient: { select: { firstName: true, lastName: true } },
                    items: { select: { medicineName: true, quantity: true, amount: true } },
                }
            }),
        ]);

        const now = new Date();
        const lowStockMedicines = allMedicines.filter(m => {
            const stock = m.openingStock + m.stockIn - m.stockOut;
            return stock <= m.minimumStockAlert && stock > 0;
        });
        const outOfStockCount = allMedicines.filter(m => {
            const stock = m.openingStock + m.stockIn - m.stockOut;
            return stock <= 0;
        }).length;
        const expiredMedicines = allMedicines.filter(m => m.expiryDate && new Date(m.expiryDate) < now);
        const totalMedicines = allMedicines.length;

        res.json({
            totalBills,
            paidBills,
            unpaidBills,
            todayBills,
            todayRevenue: todayRevenue._sum.totalAmount || 0,
            totalRevenue: totalRevenue._sum.totalAmount || 0,
            lowStockMedicines: lowStockMedicines.map(m => ({
                ...m,
                currentStock: m.openingStock + m.stockIn - m.stockOut,
            })),
            outOfStockCount,
            expiredCount: expiredMedicines.length,
            expiredMedicines: expiredMedicines.map(m => ({
                ...m,
                currentStock: m.openingStock + m.stockIn - m.stockOut,
            })),
            totalMedicines,
            recentSales,
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/pharmacy-invoices
export const getPharmacyInvoices = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const invoices = await prisma.pharmacyInvoice.findMany({
            where: { clinicId },
            include: { 
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
                items: {
                    include: {
                        medicine: true
                    }
                }
            },
            orderBy: { createdAt: "desc" },
        });

        res.json(invoices);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/pharmacy-invoices/:id
export const getPharmacyInvoiceById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const invoice = await prisma.pharmacyInvoice.findFirst({
            where: { id, clinicId: clinicId! },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true, address1: true } },
                items: {
                    include: {
                        medicine: true
                    }
                }
            }
        });

        if (!invoice) return res.status(404).json({ message: "Invoice not found" });
        res.json(invoice);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/pharmacy-invoices
export const createPharmacyInvoice = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const {
            patientId, customerName, customerPhone,
            discount, tax, subTotal, totalAmount,
            paymentMethod, paymentStatus, items
        } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Invoice items are required" });
        }

        const invoiceNo = `PH-INV-${Math.floor(100000 + Math.random() * 900000)}`;

        // Execute as a Prisma transaction to make sure stock is deducted and invoice is saved atomially
        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Invoice
            const newInvoice = await tx.pharmacyInvoice.create({
                data: {
                    invoiceNo,
                    patientId: patientId || null,
                    customerName: customerName || null,
                    customerPhone: customerPhone || null,
                    discount: parseFloat(discount) || 0,
                    tax: parseFloat(tax) || 0,
                    subTotal: parseFloat(subTotal) || 0,
                    totalAmount: parseFloat(totalAmount) || 0,
                    paymentMethod: paymentMethod || "Cash",
                    paymentStatus: paymentStatus || "Paid",
                    clinicId,
                }
            });

            // 2. Validate & Create Items & Deduct Stock
            const createdItemsData = [];
            for (const item of items) {
                const qty = parseInt(item.quantity) || 1;
                const medicineId = item.medicineId;

                if (medicineId) {
                    const medicine = await tx.medicine.findUnique({ where: { id: medicineId } });

                    if (!medicine) throw new Error(`Medicine not found: ${item.medicineName}`);

                    // ❌ Expired medicine check
                    if (medicine.expiryDate && new Date(medicine.expiryDate) < new Date()) {
                        throw new Error(`Medicine "${medicine.medicineName}" is expired and cannot be sold.`);
                    }

                    // ❌ Negative stock / insufficient stock check
                    const currentStock = medicine.openingStock + medicine.stockIn - medicine.stockOut;
                    if (currentStock < qty) {
                        throw new Error(`Insufficient stock for "${medicine.medicineName}". Available: ${currentStock}, Requested: ${qty}`);
                    }
                }

                // Create the invoice item
                const createdItem = await tx.pharmacyInvoiceItem.create({
                    data: {
                        invoiceId: newInvoice.id,
                        medicineId: medicineId || null,
                        medicineName: item.medicineName,
                        quantity: qty,
                        unitCost: parseFloat(item.unitCost) || 0,
                        gst: parseFloat(item.gst) || 0,
                        amount: parseFloat(item.amount) || 0,
                        clinicId,
                    }
                });
                createdItemsData.push(createdItem);

                // Deduct stock if medicineId exists
                if (medicineId) {
                    await tx.medicine.update({
                        where: { id: medicineId },
                        data: { stockOut: { increment: qty } }
                    });
                }
            }

            // 3. Clone to main Invoice model if Paid / Completed
            if (paymentStatus === "Paid" || paymentStatus === "Completed") {
                await tx.invoice.create({
                    data: {
                        clinicId,
                        patientId: patientId || null,
                        invoiceDate: new Date(),
                        dueDate: new Date(),
                        tax: parseFloat(tax) || 0,
                        discount: parseFloat(discount) || 0,
                        subTotal: parseFloat(subTotal) || 0,
                        totalAmount: parseFloat(totalAmount) || 0,
                        paymentMethod: paymentMethod || "Cash",
                        paymentStatus: "Paid",
                        otherInfo: "Pharmacy",
                        invoiceCode: invoiceNo,
                        items: {
                            create: createdItemsData.map((item) => ({
                                clinicId,
                                description: `${item.medicineName} (Qty: ${item.quantity})`,
                                quantity: item.quantity,
                                unitCost: item.unitCost,
                                amount: item.amount,
                            }))
                        }
                    }
                });
            }

            return newInvoice;
        });

        // Fetch complete invoice with patient & items to return
        const finalInvoice = await prisma.pharmacyInvoice.findFirst({
            where: { id: result.id },
            include: {
                patient: true,
                items: {
                    include: {
                        medicine: true
                    }
                }
            }
        });

        res.status(201).json(finalInvoice);
    } catch (err: any) {
        console.error("Create Pharmacy Invoice Error:", err);
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/pharmacy-invoices/:id
export const deletePharmacyInvoice = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const invoice = await prisma.pharmacyInvoice.findFirst({
            where: { id, clinicId: clinicId! },
            include: { items: true }
        });

        if (!invoice) return res.status(404).json({ message: "Invoice not found" });

        await prisma.$transaction(async (tx) => {
            // Restore stock for all medicines
            for (const item of invoice.items) {
                if (item.medicineId) {
                    await tx.medicine.update({
                        where: { id: item.medicineId },
                        data: {
                            stockOut: { decrement: item.quantity }
                        }
                    });
                }
            }

            // Delete invoice items
            await tx.pharmacyInvoiceItem.deleteMany({
                where: { invoiceId: id }
            });

            // Delete invoice
            await tx.pharmacyInvoice.delete({
                where: { id }
            });

            // Delete cloned invoice
            await tx.invoice.deleteMany({
                where: { invoiceCode: invoice.invoiceNo, clinicId: clinicId! }
            });
        });

        res.json({ message: "Invoice deleted successfully and stock reverted" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
