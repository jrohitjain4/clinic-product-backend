import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/ipd/invoices
export const getIPDInvoices = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const admissionId = req.query.admissionId as string;
    const patientId = req.query.patientId as string;

    const invoices = await prisma.iPDInvoice.findMany({
      where: {
        clinicId,
        ...(admissionId ? { admissionId } : {}),
        ...(patientId ? { patientId } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
        admission: { select: { id: true, admissionCode: true, ward: { select: { wardName: true } } } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(invoices);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/invoices (Raise New IPD Charge / Invoice)
export const createIPDInvoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const {
      admissionId,
      items, // Array of { itemType, itemName, unitPrice, quantity }
      paymentMethod,
      paidAmount,
      notes,
      invoiceDate,
    } = req.body;

    if (!admissionId) {
      return res.status(400).json({ message: "Admission selection is required" });
    }

    const admission = await prisma.iPDAdmission.findFirst({
      where: { id: admissionId, clinicId },
    });

    if (!admission) {
      return res.status(404).json({ message: "Admission record not found" });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one charge item is required" });
    }

    let calculatedTotal = 0;
    const formattedItems = items.map((it: any) => {
      const uPrice = parseFloat(it.unitPrice) || 0;
      const qty = parseInt(it.quantity, 10) || 1;
      const tPrice = uPrice * qty;
      calculatedTotal += tPrice;
      return {
        itemType: it.itemType || "Other", // Doctor Visit, Nurse Visit, Medicine, Ward Charge, Treatment, Other
        itemName: it.itemName || "IPD Service Charge",
        unitPrice: uPrice,
        quantity: qty,
        totalPrice: tPrice,
      };
    });

    const pPaid = paidAmount !== undefined && paidAmount !== "" ? parseFloat(paidAmount) : 0;
    const dueAmt = Math.max(0, calculatedTotal - pPaid);
    const pStatus = pPaid >= calculatedTotal ? "Paid" : pPaid > 0 ? "Partial" : "Unpaid";

    // Auto-generate invoice number
    const count = await prisma.iPDInvoice.count({ where: { clinicId } });
    const invoiceNumber = `IPD-INV-${String(count + 1).padStart(4, "0")}`;

    const invoice = await prisma.iPDInvoice.create({
      data: {
        invoiceNumber,
        admissionId,
        patientId: admission.patientId,
        totalAmount: calculatedTotal,
        paidAmount: pPaid,
        dueAmount: dueAmt,
        paymentStatus: pStatus,
        paymentMethod: paymentMethod || "Cash",
        notes: notes || null,
        clinicId,
        items: {
          create: formattedItems,
        },
        ...(invoiceDate ? { createdAt: new Date(invoiceDate) } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        admission: { select: { id: true, admissionCode: true } },
        items: true,
      },
    });

    // Update parent Admission overall totals
    const newTotalAmount = admission.totalAmount + calculatedTotal;
    const newTotalPaid = admission.totalPaid + pPaid;
    const newDueAmount = Math.max(0, newTotalAmount - newTotalPaid);
    const newPaymentStatus = newTotalPaid >= newTotalAmount ? "Paid" : newTotalPaid > 0 ? "Partial" : "Unpaid";

    await prisma.iPDAdmission.update({
      where: { id: admissionId },
      data: {
        totalAmount: newTotalAmount,
        totalPaid: newTotalPaid,
        dueAmount: newDueAmount,
        paymentStatus: newPaymentStatus,
      },
    });

    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/ipd/invoices/:id/pay (Collect Payment on Invoice)
export const addIPDInvoicePayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;
    const { paymentAmount, paymentMethod } = req.body;

    const invoice = await prisma.iPDInvoice.findFirst({
      where: { id, clinicId: clinicId! },
    });

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    const payAmt = parseFloat(paymentAmount) || 0;
    if (payAmt <= 0) return res.status(400).json({ message: "Enter a valid payment amount" });

    const newPaid = invoice.paidAmount + payAmt;
    const newDue = Math.max(0, invoice.totalAmount - newPaid);
    const newStatus = newPaid >= invoice.totalAmount ? "Paid" : "Partial";

    const updatedInvoice = await prisma.iPDInvoice.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        dueAmount: newDue,
        paymentStatus: newStatus,
        paymentMethod: paymentMethod || invoice.paymentMethod,
      },
    });

    // Update parent Admission overall totals
    const admission = await prisma.iPDAdmission.findUnique({ where: { id: invoice.admissionId } });
    if (admission) {
      const admNewPaid = admission.totalPaid + payAmt;
      const admNewDue = Math.max(0, admission.totalAmount - admNewPaid);
      const admNewStatus = admNewPaid >= admission.totalAmount ? "Paid" : "Partial";

      await prisma.iPDAdmission.update({
        where: { id: admission.id },
        data: {
          totalPaid: admNewPaid,
          dueAmount: admNewDue,
          paymentStatus: admNewStatus,
        },
      });
    }

    res.json(updatedInvoice);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/invoices/trigger-daily-ward-charges (Manual trigger for daily 11 AM ward charges)
export const triggerDailyWardCharges = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const { processDailyWardCharges } = await import("../services/wardChargeCron.service");
    const result = await processDailyWardCharges(clinicId);

    res.json({
      message: `Successfully processed daily ward charges. ${result.generatedCount} invoice(s) generated totaling ₹${result.totalAmountGenerated}`,
      result,
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
