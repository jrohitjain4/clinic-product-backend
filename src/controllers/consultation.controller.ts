import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const generateConsultationCode = async (clinicId: string): Promise<string> => {
  const count = await prisma.consultation.count({ where: { clinicId } });
  return `CON-${String(count + 1).padStart(4, "0")}`;
};

/** Add days to a Date, returning a new Date */
const addDays = (date: Date, days: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

/** Compute the list of scheduled dates for N sessions starting from startDate */
const computeSessionDates = (
  startDate: Date,
  totalSessions: number,
  scheduleType: string,
  customDates?: any
): Date[] => {
  const dates: Date[] = [];

  if (scheduleType === "custom" && Array.isArray(customDates)) {
    return customDates.map((d: string) => new Date(d)).slice(0, totalSessions);
  }

  let current = new Date(startDate);
  for (let i = 0; i < totalSessions; i++) {
    dates.push(new Date(current));
    if (scheduleType === "daily") {
      current = addDays(current, 1);
    } else if (scheduleType === "alternate") {
      current = addDays(current, 2);
    } else if (scheduleType === "weekly") {
      current = addDays(current, 7);
    } else {
      current = addDays(current, 1);
    }
  }
  return dates;
};

/** Combine a date with an HH:mm time string */
const combineDateAndTime = (date: Date, timeStr: string): Date => {
  const parts = timeStr.split(":");
  const d = new Date(date);
  d.setHours(parseInt(parts[0] || "0"), parseInt(parts[1] || "0"), 0, 0);
  return d;
};

/** Determine payment status of child appointments based on master invoice */
const getChildPaymentStatus = (paymentStatus: string): string => {
  if (paymentStatus === "Paid") return "Paid";
  if (paymentStatus === "Partial Paid") return "Partial Paid";
  return "Unpaid";
};

const consultationInclude = {
  appointment: {
    select: {
      id: true,
      appointmentCode: true,
      scheduledAt: true,
      status: true,
      patient: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
      doctor: { select: { id: true, fullName: true, profileImage: true } },
    },
  },
  patient: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
  doctor: { select: { id: true, fullName: true, profileImage: true } },
  therapyPlans: {
    include: {
      childAppointments: {
        select: {
          id: true, appointmentCode: true, scheduledAt: true, status: true,
          paymentStatus: true, sessionNumber: true, finalFee: true,
        },
        orderBy: { sessionNumber: "asc" as const },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  invoice: {
    select: { id: true, invoiceCode: true, totalAmount: true, paymentStatus: true, paymentMethod: true },
  },
};

// ─────────────────────────────────────────────────────────────
// POST /api/consultations  – Create consultation + plans + child appointments + invoice
// ─────────────────────────────────────────────────────────────
export const createConsultation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });

    const {
      appointmentId,
      examinationNotes,
      bodyPoints,
      medicines = [],
      advice,
      attachments = [],
      therapyPlans = [],
      consultationFee = 0,
      discountType = "none",
      discountValue = 0,
      amountPaid = 0,
      paymentMethod,
      whatsappNotification = false,
      status = "Draft",
    } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ message: "appointmentId is required" });
    }

    // Verify appointment belongs to clinic
    const parentAppt = await prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
      include: {
        patient: true,
        doctor: true,
      },
    });
    if (!parentAppt) {
      return res.status(404).json({ message: "Appointment not found" });
    }

    // Check if consultation already exists for this appointment
    const existing = await prisma.consultation.findUnique({ where: { appointmentId } });
    if (existing) {
      return res.status(409).json({ message: "Consultation already exists for this appointment", id: existing.id });
    }

    // Compute pricing
    const consultFee = parseFloat(String(consultationFee)) || 0;
    const therapyTotal = therapyPlans.reduce(
      (s: number, p: any) => s + (parseInt(String(p.totalSessions)) || 0) * (parseFloat(String(p.sessionFee)) || 0),
      0
    );

    let discountAmt = 0;
    const discVal = parseFloat(String(discountValue)) || 0;
    if (discountType === "percentage") {
      discountAmt = ((consultFee + therapyTotal) * discVal) / 100;
    } else if (discountType === "fixed") {
      discountAmt = discVal;
    }
    const finalTotal = Math.max(0, consultFee + therapyTotal - discountAmt);
    const paidAmt = parseFloat(String(amountPaid)) || 0;

    let paymentStatus = "Unpaid";
    if (paidAmt >= finalTotal && finalTotal > 0) paymentStatus = "Paid";
    else if (paidAmt > 0) paymentStatus = "Partial Paid";

    const consultCode = await generateConsultationCode(clinicId);

    // Create consultation with therapy plans in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create consultation
      const consultation = await tx.consultation.create({
        data: {
          consultationCode: consultCode,
          appointmentId,
          patientId: parentAppt.patientId,
          doctorId: parentAppt.doctorId,
          clinicId,
          examinationNotes: examinationNotes || null,
          bodyPoints: bodyPoints || [],
          medicines: medicines || [],
          advice: advice || null,
          attachments: attachments || [],
          consultationFee: consultFee,
          discountType,
          discountValue: discVal,
          discountAmount: discountAmt,
          therapyTotalAmount: therapyTotal,
          finalTotalAmount: finalTotal,
          amountPaid: paidAmt,
          paymentMethod: paymentMethod || null,
          paymentStatus,
          whatsappNotification,
          status,
        },
      });

      const childPayStatus = getChildPaymentStatus(paymentStatus);
      const createdPlans = [];

      // 2. For each therapy plan, create the plan + child appointments
      for (const planData of therapyPlans) {
        const sessions = parseInt(String(planData.totalSessions || 1));
        const sessionFee = parseFloat(String(planData.sessionFee || 0));
        const startDate = planData.startDate ? new Date(planData.startDate) : new Date();

        const sessionDates = computeSessionDates(
          startDate,
          sessions,
          planData.scheduleType || "daily",
          planData.customDates
        );

        // Create therapy plan
        const plan = await tx.therapyPlan.create({
          data: {
            consultationId: consultation.id,
            clinicId,
            therapyId: planData.therapyId || null,
            therapyName: planData.therapyName || null,
            therapyCategoryId: planData.therapyCategoryId || null,
            therapyCategoryName: planData.therapyCategoryName || null,
            totalSessions: sessions,
            sessionFee,
            startDate,
            sessionTime: planData.sessionTime || null,
            scheduleType: planData.scheduleType || "daily",
            customDates: planData.customDates || null,
            notes: planData.notes || null,
          },
        });

        // Count existing appointments in this clinic for code generation
        let apptCount = await tx.appointment.count({ where: { clinicId } });

        // Create child appointments for each session
        for (let i = 0; i < sessionDates.length; i++) {
          const sessionDate = sessionDates[i];

          // Combine session date with sessionTime if provided
          let scheduledAt = sessionDate;
          if (planData.sessionTime) {
            scheduledAt = combineDateAndTime(sessionDate, planData.sessionTime);
          }

          apptCount++;
          const apptCode = `APT-TH-${String(apptCount).padStart(4, "0")}`;

          await tx.appointment.create({
            data: {
              appointmentCode: apptCode,
              patientId: parentAppt.patientId,
              doctorId: parentAppt.doctorId,
              clinicId,
              scheduledAt,
              mode: parentAppt.mode || "Offline",
              appointmentType: "therapy",
              status: (childPayStatus === "Paid" || childPayStatus === "Partial Paid") ? "Confirmed" : "Schedule",
              parentAppointmentId: appointmentId,
              consultationId: consultation.id,
              therapyPlanId: plan.id,
              sessionNumber: i + 1,
              therapyId: planData.therapyId || null,
              therapyCategoryId: planData.therapyCategoryId || null,
              consultationFee: sessionFee,
              finalFee: sessionFee,
              paymentStatus: childPayStatus,
              isFollowUp: false,
            },
          });
        }

        createdPlans.push(plan);
      }

      // 3. Create master invoice
      let invoiceCount = await tx.invoice.count({ where: { clinicId } });
      invoiceCount++;
      const invoiceCode = `INV-CON-${String(invoiceCount).padStart(4, "0")}`;

      const invoiceItems = [];

      // Consultation fee line item
      if (consultFee > 0) {
        invoiceItems.push({
          description: "Consultation Fee",
          quantity: 1,
          unitCost: consultFee,
          amount: consultFee,
          clinicId,
        });
      }

      // Therapy plan line items
      for (const planData of therapyPlans) {
        const sessions = parseInt(String(planData.totalSessions || 1));
        const sessionFee = parseFloat(String(planData.sessionFee || 0));
        invoiceItems.push({
          description: `${planData.therapyName || "Therapy"} (${sessions} sessions × ₹${sessionFee})`,
          quantity: sessions,
          unitCost: sessionFee,
          amount: sessions * sessionFee,
          clinicId,
        });
      }

      const invoice = await tx.invoice.create({
        data: {
          invoiceCode,
          patientId: parentAppt.patientId,
          clinicId,
          invoiceDate: new Date(),
          dueDate: new Date(),
          subTotal: consultFee + therapyTotal,
          discount: discountAmt,
          totalAmount: finalTotal,
          paymentMethod: paymentMethod || null,
          paymentStatus: paidAmt >= finalTotal && finalTotal > 0 ? "Paid" : paidAmt > 0 ? "Partially Paid" : "Pending",
          consultationId: consultation.id,
          items: { create: invoiceItems },
        },
      });

      // Update consultation with invoice id
      await tx.consultation.update({
        where: { id: consultation.id },
        data: { },
      });

      return { consultation, invoice, plans: createdPlans };
    });

    const full = await prisma.consultation.findUnique({
      where: { id: result.consultation.id },
      include: consultationInclude,
    });

    return res.status(201).json(full);
  } catch (err: any) {
    console.error("createConsultation error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/consultations
// ─────────────────────────────────────────────────────────────
export const getConsultations = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });

    const { patientId } = req.query;
    const where: any = { clinicId };
    if (patientId) {
      where.patientId = String(patientId);
    }

    const consultations = await prisma.consultation.findMany({
      where,
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
        doctor: { select: { id: true, fullName: true, profileImage: true } },
        invoice: { select: { id: true, invoiceCode: true, totalAmount: true, paymentStatus: true } },
        therapyPlans: { select: { id: true, therapyName: true, totalSessions: true, sessionFee: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(consultations);
  } catch (err: any) {
    console.error("getConsultations error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/consultations/:id
// ─────────────────────────────────────────────────────────────
export const getConsultationById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const consultation = await prisma.consultation.findFirst({
      where: { id, clinicId },
      include: consultationInclude,
    });

    if (!consultation) return res.status(404).json({ message: "Consultation not found" });
    return res.json(consultation);
  } catch (err: any) {
    console.error("getConsultationById error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/consultations/:id  – Update (examination always editable; Step 2 only if still Draft)
// ─────────────────────────────────────────────────────────────
export const updateConsultation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const existing = await prisma.consultation.findFirst({ where: { id, clinicId } });
    if (!existing) return res.status(404).json({ message: "Consultation not found" });

    const {
      examinationNotes,
      bodyPoints,
      medicines,
      advice,
      attachments,
      status,
    } = req.body;

    // Examination, medicines, advice, and attachments are always editable
    const updated = await prisma.consultation.update({
      where: { id },
      data: {
        examinationNotes: examinationNotes !== undefined ? examinationNotes : existing.examinationNotes,
        bodyPoints: bodyPoints !== undefined ? bodyPoints : existing.bodyPoints,
        medicines: medicines !== undefined ? medicines : existing.medicines,
        advice: advice !== undefined ? advice : existing.advice,
        attachments: attachments !== undefined ? attachments : existing.attachments,
        status: status || existing.status,
      },
      include: consultationInclude,
    });

    return res.json(updated);
  } catch (err: any) {
    console.error("updateConsultation error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/consultations/:id/payment  – Update payment amount received
// ─────────────────────────────────────────────────────────────
export const updateConsultationPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const { amountPaid, paymentMethod } = req.body;

    const consultation = await prisma.consultation.findFirst({
      where: { id, clinicId },
      include: { invoice: true },
    });
    if (!consultation) return res.status(404).json({ message: "Consultation not found" });

    const paidAmt = parseFloat(String(amountPaid)) || 0;
    const finalTotal = consultation.finalTotalAmount || 0;

    let paymentStatus = "Unpaid";
    if (paidAmt >= finalTotal && finalTotal > 0) paymentStatus = "Paid";
    else if (paidAmt > 0) paymentStatus = "Partial Paid";

    const childPayStatus = getChildPaymentStatus(paymentStatus);

    await prisma.$transaction(async (tx) => {
      // Update consultation
      await tx.consultation.update({
        where: { id },
        data: { amountPaid: paidAmt, paymentStatus, paymentMethod: paymentMethod || null },
      });

      // Update invoice
      if (consultation.invoice?.id) {
        const invoicePayStatus =
          paymentStatus === "Paid" ? "Paid" :
          paymentStatus === "Partial Paid" ? "Partially Paid" : "Pending";
        await tx.invoice.update({
          where: { id: consultation.invoice.id },
          data: { paymentStatus: invoicePayStatus, paymentMethod: paymentMethod || null },
        });
      }

      // Update all child appointments
      const isConfirmed = childPayStatus === "Paid" || childPayStatus === "Partial Paid";
      if (isConfirmed) {
        await tx.appointment.updateMany({
          where: { consultationId: id, clinicId, status: "Schedule" },
          data: { 
            paymentStatus: childPayStatus,
            status: "Confirmed"
          },
        });
        await tx.appointment.updateMany({
          where: { consultationId: id, clinicId, status: { not: "Schedule" } },
          data: { paymentStatus: childPayStatus },
        });
      } else {
        await tx.appointment.updateMany({
          where: { consultationId: id, clinicId, status: "Confirmed" },
          data: { 
            paymentStatus: childPayStatus,
            status: "Schedule"
          },
        });
        await tx.appointment.updateMany({
          where: { consultationId: id, clinicId, status: { notIn: ["Confirmed", "Schedule"] } },
          data: { paymentStatus: childPayStatus },
        });
      }
    });

    const updated = await prisma.consultation.findUnique({ where: { id }, include: consultationInclude });
    return res.json(updated);
  } catch (err: any) {
    console.error("updateConsultationPayment error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/consultations/:id
// ─────────────────────────────────────────────────────────────
export const deleteConsultation = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(401).json({ message: "Unauthorized" });

    const { id } = req.params;
    const consultation = await prisma.consultation.findFirst({ where: { id, clinicId } });
    if (!consultation) return res.status(404).json({ message: "Consultation not found" });

    // Cascade deletes plans + child appointments due to schema onDelete: Cascade
    await prisma.consultation.delete({ where: { id } });
    return res.json({ message: "Consultation deleted" });
  } catch (err: any) {
    console.error("deleteConsultation error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};
