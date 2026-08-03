import prisma from "../lib/prisma";

/**
 * Process automatic daily 11 AM ward charges for all active admissions
 * Returns summary of invoices generated.
 */
export const processDailyWardCharges = async (clinicIdFilter?: string) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
    const endOfToday = new Date(`${todayStr}T23:59:59.999Z`);

    // Find all active admissions with assigned ward
    const activeAdmissions = await prisma.iPDAdmission.findMany({
      where: {
        status: "Admitted",
        wardId: { not: null },
        ...(clinicIdFilter ? { clinicId: clinicIdFilter } : {}),
      },
      include: {
        ward: true,
        patient: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    let generatedCount = 0;
    let totalAmountGenerated = 0;
    const details: any[] = [];

    for (const adm of activeAdmissions) {
      if (!adm.ward) continue;

      const wardRate = adm.ward.chargePerNight || adm.wardCharge || 0;
      const nursingRate = adm.ward.nursingChargePerNight || adm.nursingFee || 0;

      if (wardRate <= 0 && nursingRate <= 0) continue;

      // Check if an automatic ward charge invoice has ALREADY been generated today for this admission
      const existingTodayInvoice = await prisma.iPDInvoice.findFirst({
        where: {
          admissionId: adm.id,
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
          items: {
            some: {
              itemType: "Ward Stay",
            },
          },
        },
      });

      if (existingTodayInvoice) {
        // Already charged for today
        continue;
      }

      // Build Items
      const items: any[] = [];
      let totalInvAmount = 0;

      if (wardRate > 0) {
        items.push({
          itemType: "Ward Stay",
          itemName: `Ward Stay: ${adm.ward.wardName} (Daily Auto Charge)`,
          unitPrice: wardRate,
          quantity: 1,
          totalPrice: wardRate,
        });
        totalInvAmount += wardRate;
      }

      if (nursingRate > 0) {
        items.push({
          itemType: "Nurse Visit",
          itemName: `Daily Nursing Care Fee (${adm.ward.wardName})`,
          unitPrice: nursingRate,
          quantity: 1,
          totalPrice: nursingRate,
        });
        totalInvAmount += nursingRate;
      }

      if (items.length === 0) continue;

      // Auto-generate invoice number
      const count = await prisma.iPDInvoice.count({ where: { clinicId: adm.clinicId } });
      const invoiceNumber = `IPD-INV-${String(count + 1).padStart(4, "0")}`;

      // Create Invoice
      await prisma.iPDInvoice.create({
        data: {
          invoiceNumber,
          admissionId: adm.id,
          patientId: adm.patientId,
          totalAmount: totalInvAmount,
          paidAmount: 0,
          dueAmount: totalInvAmount,
          paymentStatus: "Unpaid",
          paymentMethod: "Cash",
          notes: `Automatic 11:00 AM daily ward stay charge for ${todayStr}`,
          clinicId: adm.clinicId,
          items: {
            create: items,
          },
        },
      });

      // Update parent Admission overall totals
      const newTotalAmount = adm.totalAmount + totalInvAmount;
      const newDueAmount = Math.max(0, newTotalAmount - adm.totalPaid);
      const newPaymentStatus = adm.totalPaid >= newTotalAmount ? "Paid" : adm.totalPaid > 0 ? "Partial" : "Unpaid";

      await prisma.iPDAdmission.update({
        where: { id: adm.id },
        data: {
          totalAmount: newTotalAmount,
          dueAmount: newDueAmount,
          paymentStatus: newPaymentStatus,
        },
      });

      generatedCount++;
      totalAmountGenerated += totalInvAmount;
      details.push({
        admissionCode: adm.admissionCode,
        patientName: `${adm.patient?.firstName || ""} ${adm.patient?.lastName || ""}`.trim(),
        amount: totalInvAmount,
        invoiceNumber,
      });
    }

    return {
      success: true,
      processedCount: activeAdmissions.length,
      generatedCount,
      totalAmountGenerated,
      details,
    };
  } catch (err: any) {
    console.error("[Daily Ward Charge Error]", err);
    throw err;
  }
};

/**
 * Start 11:00 AM Cron Scheduler
 * Checks every minute if current time is 11:00 AM.
 */
let lastRunDateStr = "";

export const startDailyWardChargeScheduler = () => {
  console.log("⏰ Daily 11:00 AM IPD Ward Charge Scheduler initialized.");

  setInterval(async () => {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const todayStr = now.toISOString().split("T")[0];

    // Trigger at 11:00 AM every day
    if (currentHours === 11 && currentMinutes === 0 && lastRunDateStr !== todayStr) {
      lastRunDateStr = todayStr;
      console.log(`[Cron] 11:00 AM Reached. Running Automatic Ward Charges for ${todayStr}...`);
      try {
        const result = await processDailyWardCharges();
        console.log(`[Cron] Ward Charges Completed: Generated ${result.generatedCount} invoices totaling ₹${result.totalAmountGenerated}`);
      } catch (err) {
        console.error(`[Cron] Error generating daily ward charges:`, err);
      }
    }
  }, 60000); // Check every 60 seconds
};
