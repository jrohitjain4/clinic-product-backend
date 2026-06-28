"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteInvoice = exports.updateInvoice = exports.getInvoiceById = exports.getInvoices = exports.createInvoice = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_controller_1 = require("./notification.controller");
const createInvoice = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            res.status(401).json({ message: "Unauthorized: No clinic ID found" });
            return;
        }
        const { patientId, invoiceDate, dueDate, tax, discount, subTotal, totalAmount, paymentMethod, paymentStatus, otherInfo, items } = req.body;
        const invoice = await prisma_1.default.invoice.create({
            data: {
                clinicId,
                patientId,
                invoiceDate: new Date(invoiceDate),
                dueDate: new Date(dueDate),
                tax: Number(tax) || 0,
                discount: Number(discount) || 0,
                subTotal: Number(subTotal) || 0,
                totalAmount: Number(totalAmount) || 0,
                paymentMethod,
                paymentStatus: paymentStatus || "Pending",
                otherInfo,
                invoiceCode: `INV-${Date.now()}`,
                items: {
                    create: (items || []).map((item) => ({
                        clinicId,
                        serviceId: item.serviceId || null,
                        description: item.description || "",
                        quantity: Number(item.quantity) || 1,
                        unitCost: Number(item.price) || 0,
                        amount: Number(item.amount) || 0
                    }))
                }
            },
            include: {
                items: true,
                patient: true
            }
        });
        // 🔔 Notify admin on new invoice
        try {
            const p = invoice.patient;
            const patientName = p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "Patient";
            await (0, notification_controller_1.createNotificationInternal)({
                clinicId,
                type: "INVOICE",
                title: "New Invoice Generated",
                message: `Invoice ${invoice.invoiceCode} for ${patientName} — ₹${invoice.totalAmount.toLocaleString("en-IN")} (${invoice.paymentStatus}).`,
                targetRole: "ADMIN",
                link: "/invoices",
            });
        }
        catch (_) { /* non-blocking */ }
        res.status(201).json(invoice);
    }
    catch (error) {
        console.error("Create Invoice Error:", error);
        res.status(500).json({ message: "Failed to create invoice", detail: error?.message });
    }
};
exports.createInvoice = createInvoice;
const getInvoices = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        let patientIdFilter = undefined;
        if (req.user?.role === "PATIENT" && req.user?.email) {
            const loggedInPatient = await prisma_1.default.patient.findFirst({
                where: { email: req.user.email, clinicId },
            });
            if (loggedInPatient) {
                patientIdFilter = loggedInPatient.id;
            }
            else {
                res.json([]);
                return;
            }
        }
        const invoices = await prisma_1.default.invoice.findMany({
            where: {
                clinicId,
                ...(patientIdFilter ? { patientId: patientIdFilter } : {})
            },
            include: {
                patient: true,
                items: true
            },
            orderBy: { createdAt: "desc" }
        });
        res.json(invoices);
    }
    catch (error) {
        console.error("Get Invoices Error:", error);
        res.status(500).json({ message: "Failed to retrieve invoices" });
    }
};
exports.getInvoices = getInvoices;
const getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId;
        let patientIdFilter = undefined;
        if (req.user?.role === "PATIENT" && req.user?.email) {
            const loggedInPatient = await prisma_1.default.patient.findFirst({
                where: { email: req.user.email, clinicId: clinicId ?? undefined },
            });
            if (loggedInPatient) {
                patientIdFilter = loggedInPatient.id;
            }
            else {
                res.status(404).json({ message: "Patient not found" });
                return;
            }
        }
        const invoice = await prisma_1.default.invoice.findFirst({
            where: {
                id,
                clinicId: clinicId ?? undefined,
                ...(patientIdFilter ? { patientId: patientIdFilter } : {})
            },
            include: {
                patient: true,
                clinic: {
                    include: {
                        landingPage: true
                    }
                },
                appointment: {
                    include: {
                        doctor: {
                            include: {
                                department: true
                            }
                        }
                    }
                },
                items: {
                    include: { service: true }
                }
            }
        });
        if (!invoice) {
            res.status(404).json({ message: "Invoice not found" });
            return;
        }
        res.json(invoice);
    }
    catch (error) {
        console.error("Get Invoice By ID Error:", error);
        res.status(500).json({ message: "Failed to retrieve invoice" });
    }
};
exports.getInvoiceById = getInvoiceById;
const updateInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }
        const existing = await prisma_1.default.invoice.findFirst({ where: { id, clinicId } });
        if (!existing) {
            res.status(404).json({ message: "Invoice not found" });
            return;
        }
        const { invoiceDate, dueDate, tax, discount, subTotal, totalAmount, paymentMethod, paymentStatus, otherInfo, items } = req.body;
        // Delete old items and recreate
        await prisma_1.default.invoiceItem.deleteMany({ where: { invoiceId: id } });
        const updated = await prisma_1.default.invoice.update({
            where: { id },
            data: {
                invoiceDate: invoiceDate ? new Date(invoiceDate) : existing.invoiceDate,
                dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
                tax: tax !== undefined ? Number(tax) : existing.tax,
                discount: discount !== undefined ? Number(discount) : existing.discount,
                subTotal: subTotal !== undefined ? Number(subTotal) : existing.subTotal,
                totalAmount: totalAmount !== undefined ? Number(totalAmount) : existing.totalAmount,
                paymentMethod: paymentMethod ?? existing.paymentMethod,
                paymentStatus: paymentStatus ?? existing.paymentStatus,
                otherInfo: otherInfo ?? existing.otherInfo,
                items: items ? {
                    create: items.map((item) => ({
                        clinicId,
                        serviceId: item.serviceId || null,
                        description: item.description || "",
                        quantity: Number(item.quantity) || 1,
                        unitCost: Number(item.price || item.unitCost) || 0,
                        amount: Number(item.amount) || 0,
                    }))
                } : undefined,
            },
            include: { items: { include: { service: true } }, patient: true }
        });
        // 🔔 Notify on payment status change
        if (paymentStatus && paymentStatus !== existing.paymentStatus) {
            try {
                const p = updated.patient;
                const patientName = p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "Patient";
                await (0, notification_controller_1.createNotificationInternal)({
                    clinicId,
                    type: "INVOICE",
                    title: `Invoice Payment ${paymentStatus}`,
                    message: `Invoice ${updated.invoiceCode} for ${patientName} marked as ${paymentStatus}.`,
                    targetRole: "ADMIN",
                    link: "/invoices",
                });
            }
            catch (_) { /* non-blocking */ }
        }
        res.json(updated);
    }
    catch (error) {
        console.error("Update Invoice Error:", error);
        res.status(500).json({ message: "Failed to update invoice", detail: error?.message });
    }
};
exports.updateInvoice = updateInvoice;
const deleteInvoice = async (req, res) => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId;
        await prisma_1.default.invoice.delete({
            where: { id, clinicId: clinicId ?? undefined }
        });
        res.json({ message: "Invoice deleted successfully" });
    }
    catch (error) {
        console.error("Delete Invoice Error:", error);
        res.status(500).json({ message: "Failed to delete invoice", error: error instanceof Error ? error.message : String(error) });
    }
};
exports.deleteInvoice = deleteInvoice;
