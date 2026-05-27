import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const prisma = new PrismaClient();

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
      profileImage: true,
    },
  },
} as const;

const doctorInclude = {
  doctor: {
    select: {
      id: true,
      fullName: true,
      profileImage: true,
      appointmentDuration: true,
      designation: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  },
} as const;

const appointmentIncludes = {
  ...patientInclude,
  ...doctorInclude,
  department: { select: { id: true, name: true } },
} as const;

const enrichAppointment = (a: {
  id: string;
  appointmentCode: string | null;
  scheduledAt: Date;
  endAt: Date | null;
  mode: string;
  appointmentType: string | null;
  status: string;
  reason: string | null;
  location: string | null;
  patientId: string;
  doctorId: string;
  departmentId: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    profileImage: string | null;
  };
  doctor: {
    id: string;
    fullName: string;
    profileImage: string | null;
    appointmentDuration: number | null;
    designation: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
  };
  department: { id: string; name: string } | null;
}) => ({
  ...a,
  dateTimeLabel: formatDateTimeLabel(a.scheduledAt),
  patientName: `${a.patient.firstName} ${a.patient.lastName}`.trim(),
  doctorName: a.doctor.fullName,
  doctorRole: a.doctor.designation?.name || a.doctor.department?.name || "—",
});

const maybeUpdatePatientLastVisit = async (
  patientId: string,
  status: string,
  scheduledAt: Date
) => {
  if (status !== "Checked Out") return;
  await prisma.patient.update({
    where: { id: patientId },
    data: { lastVisitedAt: scheduledAt },
  });
};

// GET /api/appointments
export const getAppointments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const { status, doctorId, patientId, mode, search, sort, dateFrom, dateTo } =
      req.query;

    let finalDoctorId = doctorId && typeof doctorId === "string" ? doctorId : undefined;

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
        ...(finalDoctorId ? { doctorId: finalDoctorId } : {}),
        ...(patientId && typeof patientId === "string" ? { patientId } : {}),
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

    res.json(appointments.map(enrichAppointment));
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
          image: a.patient.profileImage || "assets/img/users/user-08.jpg",
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
    res.json(enrichAppointment(appointment));
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
    } = req.body;

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
    let resolvedEnd = endAt ? new Date(endAt) : null;
    if (!resolvedEnd && doctor.appointmentDuration) {
      resolvedEnd = new Date(scheduled.getTime() + doctor.appointmentDuration * 60000);
    }

    const resolvedMode = mode || modeFromAppointmentType(appointmentType);
    const resolvedStatus = normalizeStatus(status);

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
      },
      include: appointmentIncludes,
    });

    await maybeUpdatePatientLastVisit(patientId, resolvedStatus, scheduled);

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
    } = req.body;

    if (doctorId) {
      const doctor = await prisma.doctor.findFirst({
        where: { id: doctorId, clinicId: clinicId! },
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
    const resolvedStatus =
      status !== undefined ? normalizeStatus(status) : existing.status;

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
      },
      include: appointmentIncludes,
    });

    await maybeUpdatePatientLastVisit(
      updated.patientId,
      resolvedStatus,
      scheduled
    );

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
