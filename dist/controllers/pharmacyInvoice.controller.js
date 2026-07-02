"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePharmacyInvoice = exports.createPharmacyInvoice = exports.getPharmacyInvoiceById = exports.getPharmacyInvoices = exports.getPharmacyDashboardStats = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/pharmacy-invoices/dashboard
const getPharmacyDashboardStats = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const [totalBills, paidBills, unpaidBills, todayBills, todayRevenue, totalRevenue, allMedicines, recentSales,] = await Promise.all([
            prisma_1.default.pharmacyInvoice.count({ where: { clinicId } }),
            prisma_1.default.pharmacyInvoice.count({ where: { clinicId, paymentStatus: "Paid" } }),
            prisma_1.default.pharmacyInvoice.count({ where: { clinicId, paymentStatus: "Unpaid" } }),
            prisma_1.default.pharmacyInvoice.count({ where: { clinicId, invoiceDate: { gte: today, lte: todayEnd } } }),
            prisma_1.default.pharmacyInvoice.aggregate({
                where: { clinicId, paymentStatus: "Paid", invoiceDate: { gte: today, lte: todayEnd } },
                _sum: { totalAmount: true },
            }),
            prisma_1.default.pharmacyInvoice.aggregate({
                where: { clinicId, paymentStatus: "Paid" },
                _sum: { totalAmount: true },
            }),
            prisma_1.default.medicine.findMany({
                where: { clinicId, status: "Active" },
                select: {
                    id: true, medicineName: true, medicineCode: true,
                    openingStock: true, stockIn: true, stockOut: true,
                    minimumStockAlert: true, expiryDate: true,
                    category: { select: { name: true } },
                }
            }),
            prisma_1.default.pharmacyInvoice.findMany({
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
            const stock = m.stockIn - m.stockOut;
            return stock <= m.minimumStockAlert && stock > 0;
        });
        const outOfStockCount = allMedicines.filter(m => {
            const stock = m.stockIn - m.stockOut;
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
                currentStock: m.stockIn - m.stockOut,
            })),
            outOfStockCount,
            expiredCount: expiredMedicines.length,
            expiredMedicines: expiredMedicines.map(m => ({
                ...m,
                currentStock: m.stockIn - m.stockOut,
            })),
            totalMedicines,
            recentSales,
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getPharmacyDashboardStats = getPharmacyDashboardStats;
// GET /api/pharmacy-invoices
const getPharmacyInvoices = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const invoices = await prisma_1.default.pharmacyInvoice.findMany({
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
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getPharmacyInvoices = getPharmacyInvoices;
// GET /api/pharmacy-invoices/:id
const getPharmacyInvoiceById = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const invoice = await prisma_1.default.pharmacyInvoice.findFirst({
            where: { id, clinicId: clinicId },
            include: {
                patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true, address1: true } },
                items: {
                    include: {
                        medicine: true
                    }
                }
            }
        });
        if (!invoice)
            return res.status(404).json({ message: "Invoice not found" });
        res.json(invoice);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getPharmacyInvoiceById = getPharmacyInvoiceById;
// POST /api/pharmacy-invoices
const createPharmacyInvoice = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { patientId, customerName, customerPhone, discount, tax, subTotal, totalAmount, paymentMethod, paymentStatus, items } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Invoice items are required" });
        }
        const invoiceNo = `PH-INV-${Math.floor(100000 + Math.random() * 900000)}`;
        // Execute as a Prisma transaction to make sure stock is deducted and invoice is saved atomially
        const result = await prisma_1.default.$transaction(async (tx) => {
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
                    if (!medicine)
                        throw new Error(`Medicine not found: ${item.medicineName}`);
                    // ❌ Expired medicine check
                    if (medicine.expiryDate && new Date(medicine.expiryDate) < new Date()) {
                        throw new Error(`Medicine "${medicine.medicineName}" is expired and cannot be sold.`);
                    }
                    // ❌ Negative stock / insufficient stock check
                    const currentStock = medicine.stockIn - medicine.stockOut;
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
        const finalInvoice = await prisma_1.default.pharmacyInvoice.findFirst({
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
    }
    catch (err) {
        console.error("Create Pharmacy Invoice Error:", err);
        res.status(500).json({ message: err.message });
    }
};
exports.createPharmacyInvoice = createPharmacyInvoice;
// DELETE /api/pharmacy-invoices/:id
const deletePharmacyInvoice = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const invoice = await prisma_1.default.pharmacyInvoice.findFirst({
            where: { id, clinicId: clinicId },
            include: { items: true }
        });
        if (!invoice)
            return res.status(404).json({ message: "Invoice not found" });
        await prisma_1.default.$transaction(async (tx) => {
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
                where: { invoiceCode: invoice.invoiceNo, clinicId: clinicId }
            });
        });
        res.json({ message: "Invoice deleted successfully and stock reverted" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deletePharmacyInvoice = deletePharmacyInvoice;
