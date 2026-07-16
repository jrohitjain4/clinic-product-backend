import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";
import { createNotificationInternal } from "./notification.controller";

export const createInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            res.status(401).json({ message: "Unauthorized: No clinic ID found" });
            return;
        }

        const {
            patientId,
            invoiceDate,
            dueDate,
            tax,
            discount,
            subTotal,
            totalAmount,
            paymentMethod,
            paymentStatus,
            otherInfo,
            items
        } = req.body;

        const invoice = await prisma.invoice.create({
            data: {
                clinicId,
                patientId,
                invoiceDate: new Date(invoiceDate),
                dueDate: new Date(dueDate),
                tax: Number(tax) || 0,
                discount: Number(discount) || 0,
                subTotal: Number(subTotal) || 0,
                totalAmount: Number(totalAmount) || 0,
                amountPaid: req.body.amountPaid !== undefined ? Number(req.body.amountPaid) : (paymentStatus === "Paid" ? Number(totalAmount || 0) : 0),
                paymentMethod,
                paymentStatus: paymentStatus || "Pending",
                otherInfo,
                invoiceCode: `INV-${Date.now()}`,
                items: {
                    create: (items || []).map((item: any) => ({
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
            const p = invoice.patient as any;
            const patientName = p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "Patient";
            await createNotificationInternal({
                clinicId,
                type: "INVOICE",
                title: "New Invoice Generated",
                message: `Invoice ${invoice.invoiceCode} for ${patientName} — ₹${invoice.totalAmount.toLocaleString("en-IN")} (${invoice.paymentStatus}).`,
                targetRole: "ADMIN",
                link: "/invoices",
            });
        } catch (_) { /* non-blocking */ }

        res.status(201).json(invoice);
    } catch (error: any) {
        console.error("Create Invoice Error:", error);
        res.status(500).json({ message: "Failed to create invoice", detail: error?.message });
    }
};

export const getInvoices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            res.status(401).json({ message: "Unauthorized" });
            return;
        }

        let patientIdFilter: string | undefined = undefined;
        if (req.user?.role === "PATIENT" && req.user?.email) {
            const loggedInPatient = await prisma.patient.findFirst({
                where: { email: req.user.email, clinicId },
            });
            if (loggedInPatient) {
                patientIdFilter = loggedInPatient.id;
            } else {
                res.json([]);
                return;
            }
        }

        const { type } = req.query;
        const where: any = {
            clinicId,
            ...(patientIdFilter ? { patientId: patientIdFilter } : {})
        };

        if (type === "therapy") {
            where.OR = [
                { appointment: { appointmentType: "therapy" } },
                { consultationId: { not: null } }
            ];
        } else if (type === "clinic") {
            where.AND = [
                { OR: [
                    { appointment: { appointmentType: { not: "therapy" } } },
                    { appointmentId: null }
                ] },
                { consultationId: null }
            ];
        }

        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                patient: true,
                items: true,
                appointment: true
            },
            orderBy: { createdAt: "desc" }
        });

        res.json(invoices);
    } catch (error) {
        console.error("Get Invoices Error:", error);
        res.status(500).json({ message: "Failed to retrieve invoices" });
    }
};

export const getInvoiceById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId;

        let patientIdFilter: string | undefined = undefined;
        if (req.user?.role === "PATIENT" && req.user?.email) {
            const loggedInPatient = await prisma.patient.findFirst({
                where: { email: req.user.email, clinicId: clinicId ?? undefined },
            });
            if (loggedInPatient) {
                patientIdFilter = loggedInPatient.id;
            } else {
                res.status(404).json({ message: "Patient not found" });
                return;
            }
        }

        const invoice = await prisma.invoice.findFirst({
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
    } catch (error) {
        console.error("Get Invoice By ID Error:", error);
        res.status(500).json({ message: "Failed to retrieve invoice" });
    }
};

export const updateInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId;
        if (!clinicId) { res.status(401).json({ message: "Unauthorized" }); return; }

        const existing = await prisma.invoice.findFirst({ where: { id, clinicId } });
        if (!existing) { res.status(404).json({ message: "Invoice not found" }); return; }

        const {
            invoiceDate, dueDate, tax, discount, subTotal,
            totalAmount, paymentMethod, paymentStatus, otherInfo, items
        } = req.body;

        // Delete old items and recreate
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });

        const updated = await prisma.invoice.update({
            where: { id },
            data: {
                invoiceDate: invoiceDate ? new Date(invoiceDate) : existing.invoiceDate,
                dueDate: dueDate ? new Date(dueDate) : existing.dueDate,
                tax: tax !== undefined ? Number(tax) : existing.tax,
                discount: discount !== undefined ? Number(discount) : existing.discount,
                subTotal: subTotal !== undefined ? Number(subTotal) : existing.subTotal,
                totalAmount: totalAmount !== undefined ? Number(totalAmount) : existing.totalAmount,
                amountPaid: req.body.amountPaid !== undefined ? Number(req.body.amountPaid) : (paymentStatus === "Paid" ? (totalAmount !== undefined ? Number(totalAmount) : existing.totalAmount) : (paymentStatus === "Pending" ? 0 : existing.amountPaid)),
                paymentMethod: paymentMethod ?? existing.paymentMethod,
                paymentStatus: paymentStatus ?? existing.paymentStatus,
                otherInfo: otherInfo ?? existing.otherInfo,
                items: items ? {
                    create: items.map((item: any) => ({
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

        // Sync consultation and child appointments if linked to a consultation
        if (existing.consultationId) {
            const finalTotal = updated.totalAmount;
            const paidAmt = updated.amountPaid;
            
            let consultPayStatus = "Unpaid";
            if (paidAmt >= finalTotal && finalTotal > 0) consultPayStatus = "Paid";
            else if (paidAmt > 0) consultPayStatus = "Partial Paid";
            
            await prisma.consultation.update({
                where: { id: existing.consultationId },
                data: {
                    amountPaid: paidAmt,
                    paymentStatus: consultPayStatus,
                    paymentMethod: updated.paymentMethod || null
                }
            });
            
            const childPayStatus = consultPayStatus === "Paid" ? "Paid" : (consultPayStatus === "Partial Paid" ? "Partial Paid" : "Unpaid");
            const isConfirmed = childPayStatus === "Paid" || childPayStatus === "Partial Paid";
            if (isConfirmed) {
                await prisma.appointment.updateMany({
                    where: { consultationId: existing.consultationId, clinicId, status: "Schedule" },
                    data: { paymentStatus: childPayStatus, status: "Confirmed" }
                });
                await prisma.appointment.updateMany({
                    where: { consultationId: existing.consultationId, clinicId, status: { not: "Schedule" } },
                    data: { paymentStatus: childPayStatus }
                });
            } else {
                await prisma.appointment.updateMany({
                    where: { consultationId: existing.consultationId, clinicId, status: "Confirmed" },
                    data: { paymentStatus: childPayStatus, status: "Schedule" }
                });
                await prisma.appointment.updateMany({
                    where: { consultationId: existing.consultationId, clinicId, status: { notIn: ["Confirmed", "Schedule"] } },
                    data: { paymentStatus: childPayStatus }
                });
            }
        }

        // 🔔 Notify on payment status change
        if (paymentStatus && paymentStatus !== existing.paymentStatus) {
            try {
                const p = updated.patient as any;
                const patientName = p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "Patient";
                await createNotificationInternal({
                    clinicId,
                    type: "INVOICE",
                    title: `Invoice Payment ${paymentStatus}`,
                    message: `Invoice ${updated.invoiceCode} for ${patientName} marked as ${paymentStatus}.`,
                    targetRole: "ADMIN",
                    link: "/invoices",
                });
            } catch (_) { /* non-blocking */ }
        }

        res.json(updated);
    } catch (error: any) {
        console.error("Update Invoice Error:", error);
        res.status(500).json({ message: "Failed to update invoice", detail: error?.message });
    }
};

export const deleteInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const clinicId = req.user?.clinicId;

        await prisma.invoice.delete({
            where: { id, clinicId: clinicId ?? undefined }
        });

        res.json({ message: "Invoice deleted successfully" });
    } catch (error) {
        console.error("Delete Invoice Error:", error);
        res.status(500).json({ message: "Failed to delete invoice", error: error instanceof Error ? error.message : String(error) });
    }
};
