import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// Helper: compute running ward charges for an active admission
function computeRunningWardCharges(admission: any): {
  daysStayed: number;
  runningWardChargePerDay: number;
  runningWardChargeTotal: number;
  runningTotalWithWard: number;
} {
  if (!admission.wardId || !admission.ward) {
    return {
      daysStayed: 0,
      runningWardChargePerDay: 0,
      runningWardChargeTotal: 0,
      runningTotalWithWard: admission.totalAmount || 0,
    };
  }

  const admitDate = new Date(admission.admissionDate);
  const endDate = admission.status === "Discharged" && admission.dischargeDate
    ? new Date(admission.dischargeDate)
    : new Date();

  // Calculate full days (minimum 1 day)
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysStayed = Math.max(1, Math.ceil((endDate.getTime() - admitDate.getTime()) / msPerDay));

  const ratePerDay = (admission.ward.chargePerNight || 0) + (admission.ward.nursingChargePerNight || 0);
  const runningWardChargeTotal = daysStayed * ratePerDay;

  // totalAmount = base charges (admission, treatment, doctor, other) + running ward
  const baseAmount = (admission.admissionFee || 0)
    + (admission.treatmentFee || 0)
    + (admission.doctorVisitCharge || 0)
    + (admission.nursingFee || 0)
    + (admission.otherCharges || 0);

  const runningTotalWithWard = baseAmount + runningWardChargeTotal;

  return {
    daysStayed,
    runningWardChargePerDay: ratePerDay,
    runningWardChargeTotal,
    runningTotalWithWard,
  };
}

// GET /api/ipd/admissions
export const getIPDAdmissions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const admissions = await prisma.iPDAdmission.findMany({
      where: { clinicId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientCode: true,
            phone: true,
            gender: true,
            age: true,
          },
        },
        doctor: {
          select: {
            id: true,
            fullName: true,
            doctorType: true,
            ipdVisitCharge: true,
          },
        },
        ward: {
          select: {
            id: true,
            wardName: true,
            wardCode: true,
            wardType: true,
            chargePerNight: true,
            nursingChargePerNight: true,
            totalBeds: true,
            occupiedBeds: true,
          },
        },
        treatment: {
          select: {
            id: true,
            procedureName: true,
            totalPrice: true,
          },
        },
        invoices: {
          include: {
            items: true,
          },
          orderBy: { createdAt: "desc" },
        },
        ipdPrescriptions: {
          include: {
            doctor: { select: { fullName: true } }
          },
          orderBy: { createdAt: "desc" }
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Append computed running ward charge fields to each admission
    const enriched = admissions.map((a) => {
      const computed = computeRunningWardCharges(a);
      const runningDueAmount = Math.max(0, computed.runningTotalWithWard - (a.totalPaid || 0) - (a.discountAmount || 0));
      return {
        ...a,
        computed: {
          ...computed,
          runningDueAmount,
        },
      };
    });

    res.json(enriched);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};


// GET /api/ipd/admissions/:id
export const getIPDAdmissionById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const admission = await prisma.iPDAdmission.findFirst({
      where: { id, clinicId: clinicId! },
      include: {
        patient: true,
        doctor: true,
        ward: true,
        treatment: true,
        invoices: {
          include: { items: true },
          orderBy: { createdAt: "desc" },
        },
        ipdPrescriptions: {
          include: {
            doctor: { select: { fullName: true } }
          },
          orderBy: { createdAt: "desc" }
        },
      },
    });

    if (!admission) return res.status(404).json({ message: "IPD Admission record not found" });
    res.json(admission);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/admissions
export const createIPDAdmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const {
      admissionType, // Direct, Refer to OPD, Emergency
      patientId,
      doctorId,
      wardId,
      treatmentId,
      diagnosis,
      admissionFee,
      treatmentFee,
      wardCharge,
      doctorVisitCharge,
      nursingFee,
      otherCharges,
      advancePaid,
      paymentMethod,
      status, // Admitted, Incomplete, etc.
      referralAppointmentId,
      referralAppointmentCode,
      treatmentReason,
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ message: "Patient selection is required" });
    }

    const admFee = admissionFee ? parseFloat(admissionFee) : 0;
    const trtFee = treatmentFee ? parseFloat(treatmentFee) : 0;
    const wCharge = wardCharge ? parseFloat(wardCharge) : 0;
    const docVisitFee = doctorVisitCharge ? parseFloat(doctorVisitCharge) : 0;
    const nurseFee = nursingFee ? parseFloat(nursingFee) : 0;
    const othFee = otherCharges ? parseFloat(otherCharges) : 0;
    const advPaid = advancePaid ? parseFloat(advancePaid) : 0;

    let effectiveWardCharge = wCharge;
    let wardName = "";

    if (wardId) {
      const assignedWardObj = await prisma.iPDWard.findUnique({ where: { id: wardId } });
      if (assignedWardObj) {
        wardName = assignedWardObj.wardName;
        if (effectiveWardCharge === 0) {
          effectiveWardCharge = assignedWardObj.chargePerNight || 0;
        }
      }
    }

    const totalEstimated = admFee + trtFee + effectiveWardCharge + docVisitFee + nurseFee + othFee;
    const dueAmt = Math.max(0, totalEstimated - advPaid);
    const pStatus = advPaid >= totalEstimated && totalEstimated > 0 ? "Paid" : advPaid > 0 ? "Partial" : "Unpaid";

    // Auto-generate Admission Code: e.g. IPD-2026-0001
    const count = await prisma.iPDAdmission.count({ where: { clinicId } });
    const admissionCode = `IPD-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

    // Create IPD Admission Record
    const admission = await prisma.iPDAdmission.create({
      data: {
        admissionCode,
        admissionType: admissionType || "Direct",
        patientId,
        doctorId: doctorId || null,
        wardId: wardId || null,
        treatmentId: treatmentId || null,
        diagnosis: diagnosis || null,
        status: status || "Admitted",
        admissionFee: admFee,
        treatmentFee: trtFee,
        wardCharge: effectiveWardCharge,
        doctorVisitCharge: docVisitFee,
        nursingFee: nurseFee,
        otherCharges: othFee,
        totalEstimatedAmount: totalEstimated,
        advancePaid: advPaid,
        totalPaid: advPaid,
        totalAmount: totalEstimated,
        dueAmount: dueAmt,
        paymentStatus: pStatus,
        paymentMethod: paymentMethod || "Cash",
        referralAppointmentId: referralAppointmentId || null,
        referralAppointmentCode: referralAppointmentCode || null,
        treatmentReason: treatmentReason || null,
        clinicId,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true, phone: true } },
        doctor: { select: { id: true, fullName: true } },
        ward: { select: { id: true, wardName: true, wardCode: true } },
        treatment: { select: { id: true, procedureName: true } },
      },
    });

    // Only update ward occupancy and create invoices if status is not Incomplete
    if (status !== "Incomplete") {
      // Increment Ward Occupancy if assigned
      if (wardId) {
        await prisma.iPDWard.update({
          where: { id: wardId },
          data: { occupiedBeds: { increment: 1 } },
        }).catch(() => {});
      }

      // Auto-generate Invoices at Admission
      let invCount = await prisma.iPDInvoice.count({ where: { clinicId } });

      const initialTotal = admFee + trtFee + docVisitFee + othFee;
      const hasInitialCharges = initialTotal > 0 || (advPaid > 0 && effectiveWardCharge === 0 && nurseFee === 0);

      if (hasInitialCharges) {
        invCount++;
        const invoiceNumber = `IPD-INV-${String(invCount).padStart(4, "0")}`;
        const initialPaid = Math.min(initialTotal, advPaid);
        const initialDue = Math.max(0, initialTotal - initialPaid);
        const initialStatus = initialPaid >= initialTotal && initialTotal > 0 ? "Paid" : initialPaid > 0 ? "Partial" : "Unpaid";

        await prisma.iPDInvoice.create({
          data: {
            invoiceNumber,
            admissionId: admission.id,
            patientId,
            totalAmount: initialTotal,
            paidAmount: initialPaid,
            dueAmount: initialDue,
            paymentStatus: initialStatus,
            paymentMethod: paymentMethod || "Cash",
            notes: `Admission Initial Deposit & Registration Invoice for ${admissionCode}`,
            clinicId,
            items: {
              create: [
                ...(admFee > 0 ? [{ itemType: "Admission Fee", itemName: "IPD Admission Registration Fee", unitPrice: admFee, quantity: 1, totalPrice: admFee }] : []),
                ...(trtFee > 0 ? [{ itemType: "Treatment Fee", itemName: "Treatment / Surgery Charges", unitPrice: trtFee, quantity: 1, totalPrice: trtFee }] : []),
                ...(docVisitFee > 0 ? [{ itemType: "Doctor Visit", itemName: "Doctor Visit / Consultation Fee", unitPrice: docVisitFee, quantity: 1, totalPrice: docVisitFee }] : []),
                ...(othFee > 0 ? [{ itemType: "Other", itemName: "Additional / Miscellaneous Charges", unitPrice: othFee, quantity: 1, totalPrice: othFee }] : []),
              ]
            }
          }
        });
      }

      const wardTotal = effectiveWardCharge + nurseFee;
      const hasWardCharges = wardTotal > 0;

      if (hasWardCharges) {
        invCount++;
        const invoiceNumber = `IPD-INV-${String(invCount).padStart(4, "0")}`;
        const leftoverAdv = Math.max(0, advPaid - initialTotal);
        const wardPaid = Math.min(wardTotal, leftoverAdv);
        const wardDue = Math.max(0, wardTotal - wardPaid);
        const wardStatus = wardPaid >= wardTotal && wardTotal > 0 ? "Paid" : wardPaid > 0 ? "Partial" : "Unpaid";

        await prisma.iPDInvoice.create({
          data: {
            invoiceNumber,
            admissionId: admission.id,
            patientId,
            totalAmount: wardTotal,
            paidAmount: wardPaid,
            dueAmount: wardDue,
            paymentStatus: wardStatus,
            paymentMethod: paymentMethod || "Cash",
            notes: `Ward Stay & Nursing Charges Invoice for ${admissionCode}`,
            clinicId,
            items: {
              create: [
                ...(effectiveWardCharge > 0 ? [{ itemType: "Ward Charge", itemName: `Ward Stay Charge (Day 1 - ${wardName || "Assigned Ward"})`, unitPrice: effectiveWardCharge, quantity: 1, totalPrice: effectiveWardCharge }] : []),
                ...(nurseFee > 0 ? [{ itemType: "Nurse Visit", itemName: "Nursing Care Fee", unitPrice: nurseFee, quantity: 1, totalPrice: nurseFee }] : []),
              ]
            }
          }
        });
      }
    }

    res.status(201).json(admission);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/ipd/admissions/:id
export const updateIPDAdmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDAdmission.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Admission record not found" });

    const {
      status,
      dischargeDate,
      diagnosis,
      totalAmount,
      totalPaid,
      dueAmount,
      paymentStatus,
    } = req.body;

    const updated = await prisma.iPDAdmission.update({
      where: { id },
      data: {
        status: status || existing.status,
        dischargeDate: dischargeDate ? new Date(dischargeDate) : existing.dischargeDate,
        diagnosis: diagnosis !== undefined ? diagnosis : existing.diagnosis,
        totalAmount: totalAmount !== undefined ? parseFloat(totalAmount) : existing.totalAmount,
        totalPaid: totalPaid !== undefined ? parseFloat(totalPaid) : existing.totalPaid,
        dueAmount: dueAmount !== undefined ? parseFloat(dueAmount) : existing.dueAmount,
        paymentStatus: paymentStatus || existing.paymentStatus,
      },
    });

    // If status changed to Discharged, decrement ward occupancy
    if (status === "Discharged" && existing.status !== "Discharged" && existing.wardId) {
      await prisma.iPDWard.update({
        where: { id: existing.wardId },
        data: { occupiedBeds: { decrement: 1 } },
      }).catch(() => {});
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/ipd/admissions/:id
export const deleteIPDAdmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDAdmission.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Admission record not found" });

    if (existing.wardId && existing.status === "Admitted") {
      await prisma.iPDWard.update({
        where: { id: existing.wardId },
        data: { occupiedBeds: { decrement: 1 } },
      }).catch(() => {});
    }

    await prisma.iPDAdmission.delete({ where: { id } });
    res.json({ message: "Admission record deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/ipd/admissions/:id/discharge (Process Discharge & Final Settlement)
export const dischargeIPDAdmission = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDAdmission.findFirst({
      where: { id, clinicId: clinicId! },
      include: { invoices: true },
    });

    if (!existing) return res.status(404).json({ message: "Admission record not found" });

    const {
      discountType, // "Fixed" or "Percentage"
      discountValue,
      paymentAmount,
      paymentMethod,
      dischargeNotes,
    } = req.body;

    const currentDue = existing.dueAmount;
    const discVal = parseFloat(discountValue) || 0;
    let computedDiscount = 0;

    if (discountType === "Percentage") {
      computedDiscount = Math.round((currentDue * discVal) / 100);
    } else {
      computedDiscount = discVal;
    }

    const payAmt = parseFloat(paymentAmount) || 0;
    const netDue = Math.max(0, currentDue - computedDiscount - payAmt);
    const newTotalPaid = existing.totalPaid + payAmt;
    const newPaymentStatus = netDue <= 0 ? "Paid" : "Partial";

    // Update IPD Admission Record to Discharged
    const updated = await prisma.iPDAdmission.update({
      where: { id },
      data: {
        status: "Discharged",
        dischargeDate: new Date(),
        discountAmount: computedDiscount,
        discountType: discountType || "Fixed",
        dischargeNotes: dischargeNotes !== undefined ? dischargeNotes : existing.dischargeNotes,
        totalPaid: newTotalPaid,
        dueAmount: netDue,
        paymentStatus: newPaymentStatus,
      },
    });

    // Decrement ward occupied beds count if patient was admitted to a ward
    if (existing.wardId && existing.status === "Admitted") {
      await prisma.iPDWard.update({
        where: { id: existing.wardId },
        data: { occupiedBeds: { decrement: 1 } },
      }).catch(() => {});
    }

    // Distribute final payment and discount to unpaid invoices
    if (payAmt > 0 || computedDiscount > 0) {
      const unpaidInvoices = existing.invoices
        .filter((inv) => inv.paymentStatus === "Unpaid" || inv.paymentStatus === "Partial")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      let remainingPay = payAmt;
      let remainingDiscount = computedDiscount;

      for (const inv of unpaidInvoices) {
        if (remainingPay <= 0 && remainingDiscount <= 0) break;

        const invoiceDue = inv.dueAmount;
        let appliedDiscount = 0;
        let appliedPayment = 0;

        if (remainingDiscount > 0) {
          appliedDiscount = Math.min(invoiceDue, remainingDiscount);
          remainingDiscount -= appliedDiscount;
        }

        const netInvoiceDue = invoiceDue - appliedDiscount;
        if (remainingPay > 0 && netInvoiceDue > 0) {
          appliedPayment = Math.min(netInvoiceDue, remainingPay);
          remainingPay -= appliedPayment;
        }

        const newInvPaid = inv.paidAmount + appliedPayment;
        const newInvDue = Math.max(0, invoiceDue - appliedDiscount - appliedPayment);
        const newInvStatus = newInvDue <= 0 ? "Paid" : "Partial";

        await prisma.iPDInvoice.update({
          where: { id: inv.id },
          data: {
            paidAmount: newInvPaid,
            dueAmount: newInvDue,
            paymentStatus: newInvStatus,
          },
        });
      }
    }

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

