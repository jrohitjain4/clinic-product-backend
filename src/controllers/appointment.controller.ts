import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";
import { createNotificationInternal } from "./notification.controller";
import { sendPatientAppointmentEmail, sendDoctorAppointmentEmail, sendClinicAppointmentNotificationEmail } from "../utils/email";

const VALID_STATUSES = [
  "Checked Out",
  "Checked In",
  "Cancelled",
  "Schedule",
  "Confirmed",
];

const formatDateTimeLabel = (date: Date) => {
  const d = date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const t = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${d} - ${t}`;
};

const modeFromAppointmentType = (appointmentType?: string | null) => {
  if (!appointmentType || appointmentType === "Select") return "In-person";
  if (appointmentType.toLowerCase().includes("online")) return "Online";
  return "In-person";
};

const normalizeStatus = (status?: string) => {
  if (!status || status === "Select") return "Schedule";
  if (status === "Scheduled") return "Schedule";
  return VALID_STATUSES.includes(status) ? status : "Schedule";
};

const patientInclude = {
  patient: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      profileImage: true,
      gender: true,
      dob: true,
      bloodGroup: true,
      address1: true,
      address2: true,
      city: true,
      state: true,
      pincode: true,
      maritalStatus: true,
    },
  },
} as const;

const doctorInclude = {
  doctor: {
    select: {
      id: true,
      fullName: true,
      profileImage: true,
      phone: true,
      email: true,
      consultationCharge: true,
      medicalLicenseNumber: true,
      yearOfExperience: true,
      appointmentDuration: true,
      maxBookingsPerSlot: true,
      followUpEnabled: true,
      freeFollowUpLimit: true,
      followUpValidityDays: true,
      followUpFee: true,
      designation: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  },
} as const;

const appointmentIncludes = {
  ...patientInclude,
  ...doctorInclude,
  department: { select: { id: true, name: true } },
  followUps: {
    select: { id: true, appointmentCode: true, scheduledAt: true, status: true, followUpPaymentStatus: true, reason: true },
    orderBy: { scheduledAt: "asc" as const },
  },
  parentAppointment: {
    select: { id: true, appointmentCode: true, scheduledAt: true, status: true },
  },
  consultation: {
    select: { id: true, status: true, paymentStatus: true },
  },
  clinic: {
    select: {
      id: true,
      name: true,
      phone: true,
      ownerEmail: true,
      ownerName: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      country: true,
      pincode: true,
      landingPage: {
        select: {
          logo: true,
          email: true,
          whatsapp: true
        }
      }
    }
  },
} as const;

const enrichAppointment = (a: any) => ({
  ...a,
  dateTimeLabel: formatDateTimeLabel(a.scheduledAt),
  patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.trim() : "(Patient Deleted)",
  doctorName: a.doctor?.fullName || "(Doctor Deleted)",
  doctorRole: a.doctor?.designation?.name || a.doctor?.department?.name || "—",
});

const maybeUpdatePatientLastVisit = async (
  patientId: string | null | undefined,
  status: string,
  scheduledAt: Date
) => {
  if (status !== "Checked Out" || !patientId) return;
  await prisma.patient.update({
    where: { id: patientId },
    data: { lastVisitedAt: scheduledAt },
  });
};

// ── Helper: Parse service duration string (e.g. "15 days", "10") → number of days
const parseServiceDurationDays = (duration?: string | null): number => {
  if (!duration) return 0;
  const match = duration.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
};

// ── Helper: Get total session days from serviceIds
const getTotalSessionDays = async (serviceIds: string[]): Promise<number> => {
  if (!serviceIds || serviceIds.length === 0) return 0;
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { duration: true },
  });
  const days = services.reduce((sum, s) => sum + parseServiceDurationDays(s.duration), 0);
  return days > 0 ? days : 0;
};

// ── Helper: Create daily session appointments (day 2 onwards) for a session
const createSessionDailyAppointments = async (
  baseAppointment: any,
  totalDays: number,
  clinicId: string,
  parentId: string
) => {
  if (totalDays <= 1) return;
  const base = new Date(baseAppointment.scheduledAt);
  const endBase = baseAppointment.endAt ? new Date(baseAppointment.endAt) : null;
  const durationMs = endBase ? endBase.getTime() - base.getTime() : 0;

  const count = await prisma.appointment.count({ where: { clinicId } });

  for (let day = 1; day < totalDays; day++) {
    const scheduledAt = new Date(base);
    scheduledAt.setDate(scheduledAt.getDate() + day);
    const endAt = endBase ? new Date(scheduledAt.getTime() + durationMs) : null;

    const apptCount = count + day;
    const appointmentCode = `AP${String(apptCount).padStart(3, "0")}`;

    await prisma.appointment.create({
      data: {
        appointmentCode,
        patientId: baseAppointment.patientId,
        doctorId: baseAppointment.doctorId,
        departmentId: baseAppointment.departmentId || null,
        scheduledAt,
        endAt,
        mode: baseAppointment.mode,
        appointmentType: baseAppointment.appointmentType || null,
        status: (baseAppointment.paymentStatus === "Paid" || baseAppointment.paymentStatus === "Partial Paid") ? "Confirmed" : "Schedule",
        reason: baseAppointment.reason || null,
        location: baseAppointment.location || null,
        clinicId,
        isFollowUp: false,
        paymentStatus: baseAppointment.paymentStatus || null,
        parentAppointmentId: parentId,
        serviceIds: baseAppointment.serviceIds || [],
      },
    });
  }
};

const ensureAppointmentInvoice = async (appointmentId: string, clinicId: string) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patient: true,
        doctor: true,
        invoice: true,
      }
    });

    if (!appointment || appointment.status !== "Confirmed" || appointment.invoice) return;
    if (appointment.appointmentType === "therapy" && appointment.parentAppointmentId !== null) return;
    if (!appointment.patient || !appointment.doctor) return; // patient or doctor was deleted

    // Determine fee
    let fee = 0;
    if (appointment.appointmentType === "therapy" && appointment.finalFee !== null && appointment.finalFee !== undefined) {
      fee = appointment.finalFee;
    } else if (appointment.isFollowUp) {
      fee = appointment.doctor.followUpFee || 0;
    } else {
      fee = appointment.doctor.consultationCharge || 0;
    }

    // Skip if free or no fee defined
    if (fee <= 0 || appointment.paymentStatus === "Free") return;

    // Auto-invoices for confirmed appointments are treated as "Paid" by default as per user request
    const invStatus = "Paid";

    await prisma.invoice.create({
      data: {
        clinicId,
        patientId: appointment.patientId,
        appointmentId: appointment.id,
        invoiceDate: new Date(),
        dueDate: new Date(),
        subTotal: fee,
        totalAmount: fee,
        amountPaid: fee,
        paymentStatus: invStatus,
        paymentMethod: appointment.mode === "Online" ? "Online" : "Cash",
        invoiceCode: `INV-AUTO-${appointment.appointmentCode || Date.now()}`,
        items: {
          create: [{
            clinicId,
            description: appointment.appointmentType === "therapy"
              ? `Therapy Consultation Fee - Dr. ${appointment.doctor.fullName}`
              : `${appointment.isFollowUp ? "Follow-up" : "Consultation"} Fee - Dr. ${appointment.doctor.fullName}`,
            quantity: 1,
            unitCost: fee,
            amount: fee,
          }]
        }
      }
    });
  } catch (err) {
    console.error("Auto-invoice creation failed:", err);
  }
};

// GET /api/appointments
export const getAppointments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const { status, doctorId, patientId, mode, search, sort, dateFrom, dateTo, appointmentType } =
      req.query;

    let finalDoctorId = doctorId && typeof doctorId === "string" ? doctorId : undefined;
    let finalPatientId = patientId && typeof patientId === "string" ? patientId : undefined;

    // Doctor isolation
    if (req.user?.role === "DOCTOR" && req.user?.email) {
      const loggedInDoctor = await prisma.doctor.findFirst({
        where: { email: req.user.email, clinicId },
      });
      if (loggedInDoctor) {
        finalDoctorId = loggedInDoctor.id;
      } else {
        // If doctor record is somehow missing, return empty
        return res.json([]);
      }
    }

    // Patient isolation
    if (req.user?.role === "PATIENT" && req.user?.email) {
      const loggedInPatient = await prisma.patient.findFirst({
        where: { email: req.user.email, clinicId },
      });
      if (loggedInPatient) {
        finalPatientId = loggedInPatient.id;
      } else {
        return res.json([]);
      }
    }

    const scheduledFilter: { gte?: Date; lte?: Date } = {};
    if (dateFrom && typeof dateFrom === "string") {
      scheduledFilter.gte = new Date(dateFrom);
    }
    if (dateTo && typeof dateTo === "string") {
      scheduledFilter.lte = new Date(dateTo);
    }

    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId,
        ...(status && typeof status === "string" ? { status } : {}),
        ...(appointmentType && typeof appointmentType === "string" ? { appointmentType } : {}),
        ...(finalDoctorId ? { doctorId: finalDoctorId } : {}),
        ...(finalPatientId ? { patientId: finalPatientId } : {}),
        ...(mode && typeof mode === "string" ? { mode } : {}),
        ...(Object.keys(scheduledFilter).length
          ? { scheduledAt: scheduledFilter }
          : {}),
        ...(search && typeof search === "string"
          ? {
            OR: [
              { appointmentCode: { contains: search, mode: "insensitive" } },
              { patient: { firstName: { contains: search, mode: "insensitive" } } },
              { patient: { lastName: { contains: search, mode: "insensitive" } } },
              { patient: { phone: { contains: search, mode: "insensitive" } } },
              { doctor: { fullName: { contains: search, mode: "insensitive" } } },
            ],
          }
          : {}),
      },
      include: appointmentIncludes,
      orderBy:
        sort === "oldest" ? { scheduledAt: "asc" } : { scheduledAt: "desc" },
    });

    const enriched = appointments.map(enrichAppointment);

    // Calculate queue info for each appointment
    const results = [];
    const queueCache: Record<string, { id: string; status: string; scheduledAt: Date }[]> = {};

    for (const app of enriched) {
      // Use localized YYYY-MM-DD to group by actual calendar day
      const d = new Date(app.scheduledAt);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cacheKey = `${app.doctorId}_${dateKey}`;

      if (!queueCache[cacheKey]) {
        const start = new Date(dateKey);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateKey);
        end.setHours(23, 59, 59, 999);

        queueCache[cacheKey] = await prisma.appointment.findMany({
          where: {
            doctorId: app.doctorId,
            clinicId,
            scheduledAt: { gte: start, lte: end },
            status: { in: ["Confirmed", "Checked In", "Checked Out", "Schedule"] },
          },
          orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
          select: { id: true, status: true, scheduledAt: true },
        });
      }

      const dayQueue = queueCache[cacheKey];
      const position = dayQueue.findIndex((q) => q.id === app.id) + 1;
      const checkoutCount = dayQueue.filter((q) => q.status === "Checked Out").length;
      const firstScheduledAt = dayQueue[0]?.scheduledAt || null;

      results.push({
        ...app,
        queuePosition: position > 0 ? position : null,
        queueCheckoutCount: checkoutCount,
        queueFirstScheduledAt: firstScheduledAt,
      });
    }

    res.json(results);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};

// GET /api/appointments/calendar
export const getAppointmentsCalendar = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    let finalDoctorId: string | undefined;
    let finalPatientId: string | undefined;

    if (req.user?.role === "DOCTOR" && req.user?.email) {
      const loggedInDoctor = await prisma.doctor.findFirst({
        where: { email: req.user.email, clinicId },
      });
      if (loggedInDoctor) {
        finalDoctorId = loggedInDoctor.id;
      } else {
        return res.json([]);
      }
    }

    if (req.user?.role === "PATIENT" && req.user?.email) {
      const loggedInPatient = await prisma.patient.findFirst({
        where: { email: req.user.email, clinicId },
      });
      if (loggedInPatient) {
        finalPatientId = loggedInPatient.id;
      } else {
        return res.json([]);
      }
    }

    const { dateFrom, dateTo } = req.query;
    const from = dateFrom ? new Date(dateFrom as string) : new Date();
    const to = dateTo
      ? new Date(dateTo as string)
      : new Date(from.getFullYear(), from.getMonth() + 2, 0);

    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId,
        scheduledAt: { gte: from, lte: to },
        ...(finalDoctorId ? { doctorId: finalDoctorId } : {}),
        ...(finalPatientId ? { patientId: finalPatientId } : {}),
      },
      include: appointmentIncludes,
      orderBy: { scheduledAt: "asc" },
    });

    const events = appointments.map((a) => {
      const enriched = enrichAppointment(a);
      return {
        id: a.id,
        title: enriched.patientName,
        start: a.scheduledAt.toISOString(),
        end: (a.endAt || a.scheduledAt).toISOString(),
        extendedProps: {
          image: a.patient?.profileImage || "assets/img/users/user-08.jpg",
          appointmentId: a.id,
          doctorName: enriched.doctorName,
          status: a.status,
          mode: a.mode,
        },
      };
    });

    res.json(events);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};

// GET /api/appointments/:id
export const getAppointmentById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const appointment = await prisma.appointment.findFirst({
      where: { id, clinicId: clinicId! },
      include: appointmentIncludes,
    });

    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    // Ensure we fetch the full chain if this is a follow-up or has follow-ups
    // We fetch all non-cancelled appointments for this specific patient-doctor pair that are linked
    const fullChain = await prisma.appointment.findMany({
      where: {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        clinicId: clinicId!,
        status: { not: "Cancelled" },
        OR: [
          { isFollowUp: true },
          { parentAppointmentId: { not: null } },
          { followUps: { some: {} } }
        ]
      },
      include: {
        doctor: { select: { id: true, fullName: true, designation: { select: { name: true } } } },
        patient: { select: { id: true, firstName: true, lastName: true, phone: true } }
      },
      orderBy: { scheduledAt: "asc" }
    });

    const enriched = enrichAppointment(appointment);
    // Attach the full chain so the frontend can display the complete history
    (enriched as any).followUpChain = fullChain;

    res.json(enriched);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};

// POST /api/appointments
export const createAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const {
      patientId,
      doctorId,
      departmentId,
      scheduledAt,
      endAt,
      mode,
      appointmentType,
      status,
      reason,
      location,
      isFollowUp,
      followUpStatus,
      paymentStatus,
      parentAppointmentId,
      serviceIds,
      onlineLink,
      homeAddress,
      therapyCategoryId,
      therapyId,
      consultationFee,
      discountType,
      discountValue,
      discountAmount,
      finalFee,
      whatsappNotification,
    } = req.body;

    const resolvedServiceIds: string[] = Array.isArray(serviceIds) ? serviceIds : [];
    const isSessionAppointment = resolvedServiceIds.length > 0;

    if (!patientId) return res.status(400).json({ message: "Patient is required" });
    if (!doctorId) return res.status(400).json({ message: "Doctor is required" });
    if (!scheduledAt) return res.status(400).json({ message: "Date and time are required" });

    const patient = await prisma.patient.findFirst({ where: { id: patientId, clinicId } });
    if (!patient) return res.status(400).json({ message: "Invalid patient" });

    const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, clinicId } });
    if (!doctor) return res.status(400).json({ message: "Invalid doctor" });

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      include: { package: true },
    });
    if (clinic?.package?.maxAppointments) {
      const count = await prisma.appointment.count({ where: { clinicId } });
      if (count >= clinic.package.maxAppointments) {
        return res.status(400).json({
          message: `Appointment limit reached (${clinic.package.maxAppointments}). Upgrade your plan.`,
        });
      }
    }

    const count = await prisma.appointment.count({ where: { clinicId } });
    const appointmentCode = `AP${String(count + 1).padStart(3, "0")}`;

    const scheduled = new Date(scheduledAt);

    // Validate slot capacity limit if doctor has slot booking active
    if (doctor.appointmentDuration && doctor.maxBookingsPerSlot) {
      const conflictingAppointments = await prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          scheduledAt: scheduled,
          status: { notIn: ["Cancelled", "Rejected"] },
        },
      });

      if (conflictingAppointments >= doctor.maxBookingsPerSlot) {
        return res.status(400).json({
          message: `The selected slot is fully booked. Only ${doctor.maxBookingsPerSlot} booking(s) allowed per slot.`,
        });
      }
    }

    let resolvedEnd = endAt ? new Date(endAt) : null;
    if (!resolvedEnd && doctor.appointmentDuration) {
      resolvedEnd = new Date(scheduled.getTime() + doctor.appointmentDuration * 60000);
    }

    const resolvedMode = mode || modeFromAppointmentType(appointmentType);
    let resolvedStatus = normalizeStatus(status);

    // ── Self-correct: Check for Follow-up status ──────────────────
    if (resolvedStatus === "Schedule" || resolvedStatus === "Confirmed") {
      if (doctor.followUpEnabled && doctor.followUpValidityDays) {
        const lastAppt = await prisma.appointment.findFirst({
          where: {
            patientId,
            doctorId,
            clinicId,
            status: "Checked Out",
            scheduledAt: { lt: scheduled },
          },
          orderBy: { scheduledAt: "desc" },
        });

        if (lastAppt) {
          const diffDays =
            (scheduled.getTime() - lastAppt.scheduledAt.getTime()) /
            (1000 * 60 * 60 * 24);
          if (diffDays <= doctor.followUpValidityDays) {
            resolvedStatus = "Follow-up";
          }
        }
      }
    }

    const appointment = await prisma.appointment.create({
      data: {
        appointmentCode,
        patientId,
        doctorId,
        departmentId: departmentId || doctor.departmentId || null,
        scheduledAt: scheduled,
        endAt: resolvedEnd,
        mode: resolvedMode,
        appointmentType: appointmentType || null,
        status: resolvedStatus,
        reason: reason || null,
        location: location || null,
        clinicId,
        isFollowUp: isFollowUp || false,
        followUpStatus: followUpStatus || null,
        paymentStatus: paymentStatus || null,
        parentAppointmentId: parentAppointmentId || null,
        serviceIds: resolvedServiceIds,
        onlineLink: onlineLink || null,
        homeAddress: homeAddress || null,
        therapyCategoryId: therapyCategoryId || null,
        therapyId: therapyId || null,
        consultationFee: consultationFee !== undefined ? parseFloat(consultationFee) : null,
        discountType: discountType || null,
        discountValue: discountValue !== undefined ? parseFloat(discountValue) : null,
        discountAmount: discountAmount !== undefined ? parseFloat(discountAmount) : null,
        finalFee: finalFee !== undefined ? parseFloat(finalFee) : null,
        whatsappNotification: whatsappNotification || false,
      },
      include: appointmentIncludes,
    });

    await maybeUpdatePatientLastVisit(patientId, resolvedStatus, scheduled);

    if (resolvedStatus === "Confirmed") {
      await ensureAppointmentInvoice(appointment.id, clinicId);

      // ── Session Appointment: create daily appointments for remaining days ──
      if (isSessionAppointment) {
        const totalDays = await getTotalSessionDays(resolvedServiceIds);
        if (totalDays > 1) {
          await createSessionDailyAppointments(appointment, totalDays, clinicId, appointment.id);
        }
      }
    }

    // 🔔 Trigger notification
    const patientName = `${patient.firstName} ${patient.lastName}`.trim();
    const sessionNote = (isSessionAppointment && resolvedStatus === "Confirmed")
      ? ` (Session: ${await getTotalSessionDays(resolvedServiceIds)} days)`
      : "";
    await createNotificationInternal({
      clinicId,
      type: "APPOINTMENT",
      title: "New Appointment Scheduled",
      message: `Appointment ${appointmentCode} for ${patientName} with Dr. ${doctor.fullName} on ${formatDateTimeLabel(scheduled)}${sessionNote}.`,
      targetRole: "ALL",
      link: `/appointments`,
    });

    // 🔴 P0 Email Notification with booking status
    if (patient.email && (resolvedStatus === "Confirmed" || resolvedStatus === "Schedule")) {
      const formattedDate = scheduled.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const formattedTime = scheduled.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      try {
        await sendPatientAppointmentEmail(
          patient.email,
          patientName,
          doctor.fullName,
          formattedDate,
          formattedTime,
          appointmentCode
        );
      } catch (emailErr) {
        console.error("Failed to send appointment confirmation email:", emailErr);
      }
    }

    // 🔴 P0 Email Notification for Doctor
    if (doctor.email && (resolvedStatus === "Confirmed" || resolvedStatus === "Schedule")) {
      const formattedDate = scheduled.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const formattedTime = scheduled.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      try {
        await sendDoctorAppointmentEmail(
          doctor.email,
          doctor.fullName,
          patientName,
          formattedDate,
          formattedTime,
          resolvedMode
        );
      } catch (emailErr) {
        console.error("Failed to send doctor appointment notification email:", emailErr);
      }
    }

    // 🔴 P0 Email Notification for Clinic Owner
    if (clinic && clinic.ownerEmail && (resolvedStatus === "Confirmed" || resolvedStatus === "Schedule")) {
      const formattedDate = scheduled.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const formattedTime = scheduled.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      try {
        await sendClinicAppointmentNotificationEmail(
          clinic.ownerEmail,
          clinic.ownerName || "Clinic Owner",
          patientName,
          doctor.fullName,
          formattedDate,
          formattedTime,
          resolvedMode
        );
      } catch (emailErr) {
        console.error("Failed to send clinic appointment notification email:", emailErr);
      }
    }

    res.status(201).json(enrichAppointment(appointment));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};

// PUT /api/appointments/:id
export const updateAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.appointment.findFirst({
      where: { id, clinicId: clinicId! },
    });
    if (!existing) return res.status(404).json({ message: "Appointment not found" });

    const {
      patientId,
      doctorId,
      departmentId,
      scheduledAt,
      endAt,
      mode,
      appointmentType,
      status,
      reason,
      location,
      isFollowUp,
      followUpStatus,
      paymentStatus,
      parentAppointmentId,
      serviceIds,
      onlineLink,
      homeAddress,
      therapyCategoryId,
      therapyId,
      consultationFee,
      discountType,
      discountValue,
      discountAmount,
      finalFee,
      whatsappNotification,
    } = req.body;

    let doctor = null;
    const targetDoctorId = doctorId ?? existing.doctorId;
    if (targetDoctorId) {
      doctor = await prisma.doctor.findFirst({
        where: { id: targetDoctorId, clinicId: clinicId! },
      });
      if (!doctor) return res.status(400).json({ message: "Invalid doctor" });
    }
    if (patientId) {
      const patient = await prisma.patient.findFirst({
        where: { id: patientId, clinicId: clinicId! },
      });
      if (!patient) return res.status(400).json({ message: "Invalid patient" });
    }

    const scheduled = scheduledAt ? new Date(scheduledAt) : existing.scheduledAt;

    if (doctor && doctor.appointmentDuration && doctor.maxBookingsPerSlot) {
      const conflictingAppointments = await prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          scheduledAt: scheduled,
          status: { notIn: ["Cancelled", "Rejected"] },
          id: { not: id },
        },
      });

      if (conflictingAppointments >= doctor.maxBookingsPerSlot) {
        return res.status(400).json({
          message: `The selected slot is fully booked. Only ${doctor.maxBookingsPerSlot} booking(s) allowed per slot.`,
        });
      }
    }
    const resolvedStatus =
      status !== undefined ? normalizeStatus(status) : existing.status;

    const resolvedServiceIds: string[] = Array.isArray(serviceIds)
      ? serviceIds
      : (existing as any).serviceIds || [];

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        patientId: patientId ?? existing.patientId,
        doctorId: doctorId ?? existing.doctorId,
        departmentId:
          departmentId !== undefined ? departmentId || null : existing.departmentId,
        scheduledAt: scheduled,
        endAt:
          endAt !== undefined
            ? endAt
              ? new Date(endAt)
              : null
            : existing.endAt,
        mode:
          mode ??
          (appointmentType !== undefined
            ? modeFromAppointmentType(appointmentType)
            : existing.mode),
        appointmentType:
          appointmentType !== undefined
            ? appointmentType || null
            : existing.appointmentType,
        status: resolvedStatus,
        reason: reason !== undefined ? reason || null : existing.reason,
        location: location !== undefined ? location || null : existing.location,
        isFollowUp: isFollowUp !== undefined ? isFollowUp : existing.isFollowUp,
        followUpStatus: followUpStatus !== undefined ? followUpStatus : existing.followUpStatus,
        paymentStatus: paymentStatus !== undefined ? paymentStatus : existing.paymentStatus,
        parentAppointmentId: parentAppointmentId !== undefined ? parentAppointmentId : existing.parentAppointmentId,
        serviceIds: resolvedServiceIds,
        onlineLink: onlineLink !== undefined ? onlineLink : existing.onlineLink,
        homeAddress: homeAddress !== undefined ? homeAddress : existing.homeAddress,
        therapyCategoryId: therapyCategoryId !== undefined ? therapyCategoryId : existing.therapyCategoryId,
        therapyId: therapyId !== undefined ? therapyId : existing.therapyId,
        consultationFee: consultationFee !== undefined ? (consultationFee ? parseFloat(consultationFee) : null) : existing.consultationFee,
        discountType: discountType !== undefined ? discountType : existing.discountType,
        discountValue: discountValue !== undefined ? (discountValue ? parseFloat(discountValue) : null) : existing.discountValue,
        discountAmount: discountAmount !== undefined ? (discountAmount ? parseFloat(discountAmount) : null) : existing.discountAmount,
        finalFee: finalFee !== undefined ? (finalFee ? parseFloat(finalFee) : null) : existing.finalFee,
        whatsappNotification: whatsappNotification !== undefined ? whatsappNotification : existing.whatsappNotification,
      },
      include: appointmentIncludes,
    });

    await maybeUpdatePatientLastVisit(
      updated.patientId,
      resolvedStatus,
      scheduled
    );

    if (resolvedStatus === "Confirmed") {
      await ensureAppointmentInvoice(updated.id, clinicId!);

      // ── Session Appointment: if being confirmed for the first time and has serviceIds,
      //    create daily appointments for remaining days (only if none already exist)
      const isNowConfirmed = existing.status !== "Confirmed" && resolvedStatus === "Confirmed";
      const hasServiceIds = resolvedServiceIds.length > 0;
      if (isNowConfirmed && hasServiceIds) {
        // Check if session children already exist
        const existingChildren = await prisma.appointment.count({
          where: { parentAppointmentId: id, clinicId: clinicId! },
        });
        if (existingChildren === 0) {
          const totalDays = await getTotalSessionDays(resolvedServiceIds);
          if (totalDays > 1) {
            await createSessionDailyAppointments(updated, totalDays, clinicId!, id);
          }
        }
      }
    }

    // 🔔 Notify on status changes
    const ptName = updated.patient ? `${updated.patient.firstName} ${updated.patient.lastName}` : "(Patient Deleted)";
    const statusMessages: Record<string, string> = {
      "Checked In": `Patient ${ptName} has checked in (Appt: ${updated.appointmentCode}).`,
      "Checked Out": `Patient ${ptName} has checked out (Appt: ${updated.appointmentCode}).`,
      "Cancelled": `Appointment ${updated.appointmentCode} for ${ptName} has been cancelled.`,
      "Confirmed": `Appointment ${updated.appointmentCode} for ${ptName} is confirmed.`,
    };
    if (status && statusMessages[resolvedStatus] && resolvedStatus !== existing.status) {
      await createNotificationInternal({
        clinicId: clinicId!,
        type: "APPOINTMENT",
        title: `Appointment ${resolvedStatus}`,
        message: statusMessages[resolvedStatus],
        targetRole: "ALL",
        link: `/appointments`,
      });
    }

    // 🔴 P0 Email Notification on appointment confirmation or updates
    const wasConfirmedOrScheduled = existing.status === "Confirmed" || existing.status === "Schedule";
    const isNowConfirmedOrScheduled = resolvedStatus === "Confirmed" || resolvedStatus === "Schedule";
    const detailsChanged = existing.scheduledAt.getTime() !== scheduled.getTime() || existing.doctorId !== (doctorId ?? existing.doctorId);

    if (updated.patient?.email && isNowConfirmedOrScheduled && (!wasConfirmedOrScheduled || detailsChanged)) {
      const formattedDate = scheduled.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const formattedTime = scheduled.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      try {
        await sendPatientAppointmentEmail(
          updated.patient.email,
          `${updated.patient.firstName} ${updated.patient.lastName}`.trim(),
          updated.doctor?.fullName || "",
          formattedDate,
          formattedTime,
          updated.appointmentCode || ""
        );
      } catch (emailErr) {
        console.error("Failed to send appointment update email:", emailErr);
      }
    }

    // 🔴 P0 Email Notification for Doctor on appointment confirmation or updates
    if (updated.doctor?.email && isNowConfirmedOrScheduled && (!wasConfirmedOrScheduled || detailsChanged)) {
      const formattedDate = scheduled.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const formattedTime = scheduled.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      try {
        await sendDoctorAppointmentEmail(
          updated.doctor.email,
          updated.doctor.fullName,
          updated.patient ? `${updated.patient.firstName} ${updated.patient.lastName}`.trim() : "(Patient Deleted)",
          formattedDate,
          formattedTime,
          updated.mode
        );
      } catch (emailErr) {
        console.error("Failed to send doctor appointment update email:", emailErr);
      }
    }

    // 🔴 P0 Email Notification for Clinic Owner on appointment confirmation or updates
    if (updated.clinic?.ownerEmail && isNowConfirmedOrScheduled && (!wasConfirmedOrScheduled || detailsChanged)) {
      const formattedDate = scheduled.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
      const formattedTime = scheduled.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
      try {
        await sendClinicAppointmentNotificationEmail(
          updated.clinic.ownerEmail,
          updated.clinic.ownerName || "Clinic Owner",
          updated.patient ? `${updated.patient.firstName} ${updated.patient.lastName}`.trim() : "(Patient Deleted)",
          updated.doctor?.fullName || "(Doctor Deleted)",
          formattedDate,
          formattedTime,
          updated.mode
        );
      } catch (emailErr) {
        console.error("Failed to send clinic appointment update email:", emailErr);
      }
    }

    res.json(enrichAppointment(updated));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};

// DELETE /api/appointments/:id
export const deleteAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.appointment.findFirst({
      where: { id, clinicId: clinicId! },
    });
    if (!existing) return res.status(404).json({ message: "Appointment not found" });

    await prisma.appointment.delete({ where: { id } });
    res.json({ message: "Appointment deleted successfully" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};

// GET /api/appointments/check-followup?patientId=X&doctorId=Y
export const checkFollowupStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { patientId, doctorId, date } = req.query;

    if (!patientId || !doctorId) {
      return res.json({ isFollowup: false });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId as string },
    });

    if (!doctor) {
      return res.json({ isFollowup: false, reason: "Doctor not found" });
    }

    if (!doctor.followUpEnabled || !doctor.followUpValidityDays) {
      return res.json({ isFollowup: false, reason: "Follow-up disabled for this doctor" });
    }

    const scheduledDate = date ? new Date(date as string) : new Date();

    // Find the latest completed appointment BEFORE this date
    const lastAppt = await prisma.appointment.findFirst({
      where: {
        patientId: patientId as string,
        doctorId: doctorId as string,
        clinicId: clinicId!,
        status: { not: "Cancelled" },
        scheduledAt: { lt: scheduledDate },
      },
      orderBy: { scheduledAt: "desc" },
    });

    if (lastAppt) {
      const diffMs = scheduledDate.getTime() - lastAppt.scheduledAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      console.log(`Checking follow-up: diffDays=${diffDays}, validity=${doctor.followUpValidityDays}`);

      if (diffDays >= 0 && diffDays <= doctor.followUpValidityDays) {
        // Link to the root parent so the entire chain remains flat and visible in one view
        const rootParentId = lastAppt.parentAppointmentId || lastAppt.id;

        const existingCount = await prisma.appointment.count({
          where: { parentAppointmentId: rootParentId, clinicId: clinicId! }
        });

        // Determine recommended defaults
        const freeLimit = doctor.freeFollowUpLimit || 0;
        const isFree = freeLimit === 0 || existingCount < freeLimit;

        return res.json({
          isFollowup: true,
          lastApptId: rootParentId,
          existingCount,
          recommendedStatus: isFree ? "Free Follow-up" : "Paid Follow-up",
          recommendedPayment: isFree ? "Free" : "Unpaid",
          diffDays,
          validity: doctor.followUpValidityDays
        });
      }
    }

    res.json({ isFollowup: false, reason: "No qualifying past appointment found" });
  } catch (err: any) {
    console.error("checkFollowupStatus error:", err);
    res.status(500).json({ message: err.message });
  }
};

// POST /api/appointments/:id/follow-up
export const createFollowUpAppointment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const { id: parentId } = req.params;
    const {
      scheduledAt,
      reason,
      status: statusOverride,
      paymentStatus: paymentOverride,
      followUpStatus: typeOverride
    } = req.body;

    if (!scheduledAt) return res.status(400).json({ message: "Scheduled date/time is required" });

    // Fetch parent appointment
    const parent = await prisma.appointment.findFirst({
      where: { id: parentId, clinicId },
      include: {
        patient: true,
        doctor: true,
      },
    });
    if (!parent) return res.status(404).json({ message: "Parent appointment not found" });

    const doctor = parent.doctor;
    if (!doctor) {
      return res.status(400).json({ message: "Doctor no longer exists for this appointment" });
    }
    if (!doctor.followUpEnabled) {
      return res.status(400).json({ message: "Follow-up is not enabled for this doctor" });
    }

    // Check validity window
    const scheduled = new Date(scheduledAt);

    // Validate slot capacity limit if doctor has slot booking active
    if (doctor.appointmentDuration && doctor.maxBookingsPerSlot) {
      const conflictingAppointments = await prisma.appointment.count({
        where: {
          doctorId: doctor.id,
          scheduledAt: scheduled,
          status: { notIn: ["Cancelled", "Rejected"] },
        },
      });

      if (conflictingAppointments >= doctor.maxBookingsPerSlot) {
        return res.status(400).json({
          message: `The selected slot is fully booked. Only ${doctor.maxBookingsPerSlot} booking(s) allowed per slot.`,
        });
      }
    }

    const diffDays = (scheduled.getTime() - parent.scheduledAt.getTime()) / (1000 * 60 * 60 * 24);
    if (doctor.followUpValidityDays && diffDays > doctor.followUpValidityDays) {
      return res.status(400).json({
        message: `Follow-up must be within ${doctor.followUpValidityDays} days of the original appointment`,
      });
    }

    // Count existing follow-ups for this parent chain
    const rootParentId = parent.parentAppointmentId || parent.id;
    const existingFollowUps = await prisma.appointment.count({
      where: {
        OR: [
          { parentAppointmentId: rootParentId },
          { id: rootParentId },
        ],
      },
    });

    // Determine payment status
    const freeLimit = doctor.freeFollowUpLimit || 0; // 0 = unlimited
    let paymentStatus: string;
    if (freeLimit === 0 || existingFollowUps <= freeLimit) {
      paymentStatus = "Free";
    } else {
      paymentStatus = "Unpaid";
    }

    // Generate appointment code
    const totalCount = await prisma.appointment.count({ where: { clinicId } });
    const appointmentCode = `AP${String(totalCount + 1).padStart(3, "0")}`;

    // Auto-compute end time from doctor duration
    let resolvedEnd: Date | null = null;
    if (doctor.appointmentDuration) {
      resolvedEnd = new Date(scheduled.getTime() + doctor.appointmentDuration * 60000);
    }

    const followUp = await prisma.appointment.create({
      data: {
        appointmentCode,
        patientId: parent.patientId,
        doctorId: parent.doctorId,
        departmentId: parent.departmentId || null,
        scheduledAt: scheduled,
        endAt: resolvedEnd,
        mode: parent.mode,
        appointmentType: parent.appointmentType,
        status: statusOverride || "Schedule",
        reason: reason || `Follow-up for ${parent.appointmentCode || parent.id}`,
        location: parent.location,
        clinicId,
        isFollowUp: true,
        followUpStatus: typeOverride || (paymentStatus === "Free" ? "Free Follow-up" : "Paid Follow-up"),
        paymentStatus: paymentOverride || paymentStatus,
        parentAppointmentId: rootParentId,
      },
      include: appointmentIncludes,
    });

    // 🔔 Notify
    const patientFullName = parent.patient ? `${parent.patient.firstName} ${parent.patient.lastName}`.trim() : "(Patient Deleted)";
    await createNotificationInternal({
      clinicId,
      type: "APPOINTMENT",
      title: "Follow-up Appointment Created",
      message: `Follow-up ${appointmentCode} (${paymentStatus}) for ${patientFullName} with Dr. ${doctor.fullName} on ${formatDateTimeLabel(scheduled)}.`,
      targetRole: "ALL",
      link: `/appointments`,
    });

    res.status(201).json(enrichAppointment(followUp));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    console.error("createFollowUpAppointment error:", err);
    res.status(500).json({ message });
  }
};


// PUT /api/appointments/:id/follow-up-payment
export const updateFollowUpPayment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;
    const { paymentStatus } = req.body; // "Paid", "Unpaid", "Free"

    if (!["Paid", "Unpaid", "Free"].includes(paymentStatus)) {
      return res.status(400).json({ message: "Invalid payment status. Must be Paid, Unpaid, or Free" });
    }

    const appointment = await prisma.appointment.findFirst({
      where: { id, clinicId: clinicId! },
    });
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    const updated = await prisma.appointment.update({
      where: { id },
      data: { followUpPaymentStatus: paymentStatus },
      include: appointmentIncludes,
    });

    res.json(enrichAppointment(updated));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Server error";
    res.status(500).json({ message });
  }
};
