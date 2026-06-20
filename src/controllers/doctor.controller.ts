import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import * as bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import prisma from "../lib/prisma";
import { createNotificationInternal } from "./notification.controller";
import { sendEmail, sendDoctorRegistrationEmail } from "../utils/email";

// GET /api/doctors
export const getDoctors = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const queryClinicId = req.query.clinicId as string;
        const clinicId = queryClinicId || req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const doctors = await prisma.doctor.findMany({
            where: { clinicId },
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json(doctors);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/doctors/:id
export const getDoctorById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const doctor = await prisma.doctor.findFirst({
            where: { id, clinicId: clinicId! },
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
                clinic: { select: { id: true, name: true } },
                specializations: { select: { id: true, name: true } },
            },
        });

        if (!doctor) return res.status(404).json({ message: "Doctor not found" });
        res.json(doctor);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/doctors
export const createDoctor = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const {
            fullName,
            username,
            phone,
            alternateMobile,
            email,
            dob,
            yearOfExperience,
            departmentId,
            designationId,
            specializations, // Array of specialization IDs
            medicalLicenseNumber,
            maritalStatus,
            qualification,
            languagesSpoken,
            bloodGroup,
            gender,
            bio,
            featureOnWebsite,
            profileImage,
            signatureImage,
            medicalRegCertificate,
            qualificationCertificate,
            aadhaarCard,
            aadhaarCardBack,
            panCard,
            address1,
            address2,
            country,
            city,
            state,
            pincode,
            appointmentType,
            acceptBookingsInAdvance,
            appointmentDuration,
            consultationCharge,
            maxBookingsPerSlot,
            displayOnBookingPage,
            followUpEnabled,
            followUpValidityDays,
            freeFollowUpLimit,
            followUpFee,
            educations,
            awards,
            certifications,
            schedules,
        } = req.body;

        if (!fullName) return res.status(400).json({ message: "Doctor name is required" });
        if (!email && !phone) return res.status(400).json({ message: "Email or Phone is required to create a doctor account" });

        // Check duplicates
        if (email) {
            const existingByEmail = await prisma.user.findFirst({ where: { email } });
            if (existingByEmail) return res.status(400).json({ message: "Email is already registered" });
        }
        if (phone) {
            const existingByPhone = await prisma.doctor.findFirst({ where: { phone, clinicId } });
            if (existingByPhone) return res.status(400).json({ message: "Phone number is already registered for another doctor" });
        }

        // Auto Doctor Code: DOC000001
        const doctorCount = await prisma.doctor.count({ where: { clinicId } });
        const doctorCode = `DOC${String(doctorCount + 1).padStart(6, "0")}`;

        const generatedPassword = req.body.password || randomBytes(4).toString("hex");
        console.log(`CREATING DOCTOR: ${fullName}`);
        console.log(`Generated Password: ${generatedPassword}`);
        const passwordHash = await bcrypt.hash(generatedPassword, 10);
        console.log(`Generated Hash: ${passwordHash}`);
        // Username defaults to phone if not provided
        const effectiveUsername = username || phone || null;

        const doctor = await prisma.$transaction(async (tx) => {
            const newDoctor = await tx.doctor.create({
                data: {
                    doctorCode,
                    fullName,
                    username: effectiveUsername,
                    phone: phone || null,
                    alternateMobile: alternateMobile || null,
                    email: email ? email.toLowerCase() : null,
                    dob: dob ? new Date(dob) : null,
                    yearOfExperience: yearOfExperience ? parseInt(yearOfExperience) : null,
                    departmentId: departmentId || null,
                    designationId: designationId || null,
                    specializations: specializations && specializations.length > 0 ? {
                        connect: specializations.map((id: string) => ({ id }))
                    } : undefined,
                    medicalLicenseNumber: medicalLicenseNumber || null,
                    maritalStatus: maritalStatus || null,
                    qualification: qualification || null,
                    languagesSpoken: languagesSpoken || [],
                    bloodGroup: bloodGroup || null,
                    gender: gender || null,
                    bio: bio || null,
                    featureOnWebsite: featureOnWebsite === true || featureOnWebsite === "true",
                    profileImage: profileImage || null,
                    signatureImage: signatureImage || null,
                    medicalRegCertificate: medicalRegCertificate || null,
                    qualificationCertificate: qualificationCertificate || null,
                    aadhaarCard: aadhaarCard || null,
                    aadhaarCardBack: aadhaarCardBack || null,
                    panCard: panCard || null,
                    address1: address1 || null,
                    address2: address2 || null,
                    country: country || null,
                    city: city || null,
                    state: state || null,
                    pincode: pincode || null,
                    appointmentType: appointmentType || null,
                    acceptBookingsInAdvance: acceptBookingsInAdvance ? parseInt(acceptBookingsInAdvance) : null,
                    appointmentDuration: appointmentDuration ? parseInt(appointmentDuration) : null,
                    consultationCharge: consultationCharge ? parseFloat(consultationCharge) : null,
                    maxBookingsPerSlot: maxBookingsPerSlot ? parseInt(maxBookingsPerSlot) : null,
                    displayOnBookingPage: displayOnBookingPage === true || displayOnBookingPage === "true",
                    followUpEnabled: followUpEnabled === true || followUpEnabled === "true",
                    followUpValidityDays: followUpValidityDays ? parseInt(followUpValidityDays) : null,
                    freeFollowUpLimit: freeFollowUpLimit ? parseInt(freeFollowUpLimit) : null,
                    followUpFee: followUpFee ? parseFloat(followUpFee) : null,
                    educations: educations || null,
                    awards: awards || null,
                    certifications: certifications || null,
                    schedules: schedules || null,
                    clinicId,
                    status: "Active",
                },
                include: {
                    department: { select: { id: true, name: true } },
                    designation: { select: { id: true, name: true } },
                    specializations: { select: { id: true, name: true } },
                },
            });

            // Create User account - login via phone OR email
            const userEmail = email ? email.toLowerCase() : `dr_${phone}@docyori.local`;
            await tx.user.create({
                data: {
                    email: userEmail,
                    phone: phone || null,
                    username: effectiveUsername,
                    passwordHash,
                    fullName,
                    role: "DOCTOR",
                    clinicId,
                }
            });

            return newDoctor;
        });

        res.status(201).json(doctor);

        // 📧 Send welcome email to doctor with login credentials
        if (email) {
            try {
                await sendDoctorRegistrationEmail(
                    email,
                    fullName,
                    doctorCode,
                    { username: effectiveUsername || email, password: generatedPassword }
                );
            } catch (_) { /* non-blocking */ }
        }

        // 🔔 Notify admin: new doctor added
        try {
            await createNotificationInternal({
                clinicId,
                type: "DOCTOR_ADDED",
                title: "New Doctor Added",
                message: `Dr. ${fullName} (${doctorCode}) has been added to the clinic${email ? ` (${email})` : ""}.`,
                targetRole: "ADMIN",
                link: "/doctors/doctor-list",
            });
        } catch (_) { /* non-blocking */ }
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};


// PUT /api/doctors/:id
export const updateDoctor = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const {
            fullName,
            username,
            phone,
            alternateMobile,
            email,
            dob,
            yearOfExperience,
            departmentId,
            designationId,
            specializations,
            medicalLicenseNumber,
            maritalStatus,
            qualification,
            languagesSpoken,
            bloodGroup,
            gender,
            bio,
            featureOnWebsite,
            profileImage,
            signatureImage,
            medicalRegCertificate,
            qualificationCertificate,
            aadhaarCard,
            aadhaarCardBack,
            panCard,
            address1,
            address2,
            country,
            city,
            state,
            pincode,
            appointmentType,
            acceptBookingsInAdvance,
            appointmentDuration,
            consultationCharge,
            maxBookingsPerSlot,
            displayOnBookingPage,
            followUpEnabled,
            followUpValidityDays,
            freeFollowUpLimit,
            followUpFee,
            educations,
            awards,
            certifications,
            schedules,
            status,
        } = req.body;

        const existing = await prisma.doctor.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Doctor not found" });

        const updatedDoctor = await prisma.doctor.update({
            where: { id },
            data: {
                fullName,
                username,
                phone,
                alternateMobile,
                email: email ? email.toLowerCase() : undefined,
                dob: dob ? new Date(dob) : undefined,
                yearOfExperience: yearOfExperience ? parseInt(yearOfExperience) : undefined,
                departmentId,
                designationId,
                specializations: specializations ? {
                    set: [], // Clear existing
                    connect: specializations.map((sid: string) => ({ id: sid }))
                } : undefined,
                medicalLicenseNumber,
                maritalStatus,
                qualification,
                languagesSpoken,
                bloodGroup,
                gender,
                bio,
                featureOnWebsite: featureOnWebsite === true || featureOnWebsite === "true",
                profileImage,
                signatureImage,
                medicalRegCertificate,
                qualificationCertificate,
                aadhaarCard,
                aadhaarCardBack,
                panCard,
                address1,
                address2,
                country,
                city,
                state,
                pincode,
                appointmentType,
                acceptBookingsInAdvance: acceptBookingsInAdvance ? parseInt(acceptBookingsInAdvance) : undefined,
                appointmentDuration: appointmentDuration ? parseInt(appointmentDuration) : undefined,
                consultationCharge: consultationCharge ? parseFloat(consultationCharge) : undefined,
                maxBookingsPerSlot: maxBookingsPerSlot ? parseInt(maxBookingsPerSlot) : undefined,
                displayOnBookingPage: displayOnBookingPage === true || displayOnBookingPage === "true",
                followUpEnabled: followUpEnabled === true || followUpEnabled === "true",
                followUpValidityDays: followUpValidityDays ? parseInt(followUpValidityDays) : undefined,
                freeFollowUpLimit: freeFollowUpLimit ? parseInt(freeFollowUpLimit) : null,
                followUpFee: followUpFee !== undefined ? (followUpFee ? parseFloat(followUpFee) : null) : undefined,
                educations: educations || undefined,
                awards: awards || undefined,
                certifications: certifications || undefined,
                schedules: schedules || undefined,
                status,
            }
        });

        res.json(updatedDoctor);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

export const deleteDoctor = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.doctor.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Doctor not found" });

        await prisma.doctor.delete({ where: { id } });

        // 🔔 Notify on doctor removal
        try {
            await createNotificationInternal({
                clinicId: clinicId!,
                type: "DOCTOR_ADDED",
                title: "Doctor Removed",
                message: `Dr. ${existing.fullName} has been removed from the clinic.`,
                targetRole: "ADMIN",
                link: "/doctors/doctor-list",
            });
        } catch (_) { /* non-blocking */ }

        res.json({ message: "Doctor deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
// GET /api/doctors/:id/availability
export const getDoctorAvailability = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id: doctorId } = req.params;
        const { startDate, endDate } = req.query;

        const doctor = await prisma.doctor.findUnique({
            where: { id: doctorId },
            select: { schedules: true, appointmentDuration: true, clinicId: true }
        });

        if (!doctor) {
            return res.status(404).json({ message: "Doctor not found" });
        }

        const clinicId = doctor.clinicId;

        const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate as string) : new Date(start.getFullYear(), start.getMonth() + 2, 0);

        // Fetch Holidays
        const holidays = await prisma.holiday.findMany({
            where: {
                clinicId,
                date: { gte: start, lte: end }
            }
        });

        // Fetch Leaves
        const leaves = await prisma.leave.findMany({
            where: {
                employeeId: doctorId,
                employeeType: "DOCTOR",
                status: "APPROVED",
                OR: [
                    { startDate: { lte: end }, endDate: { gte: start } }
                ]
            }
        });

        // Fetch Appointments
        const appointments = await prisma.appointment.findMany({
            where: {
                doctorId,
                scheduledAt: { gte: start, lte: end },
                status: { notIn: ["Cancelled", "Rejected"] }
            },
            select: { scheduledAt: true, endAt: true }
        });

        // Fetch Working Days Config
        const workingDaysConfig = await prisma.workingDaysConfig.findUnique({
            where: { clinicId }
        });

        res.json({
            schedules: doctor.schedules,
            duration: doctor.appointmentDuration || 30,
            holidays: holidays.map((h: any) => ({ date: h.date, endDate: h.endDate, title: h.title })),
            leaves: leaves.map((l: any) => ({ start: l.startDate, end: l.endDate })),
            appointments: appointments.map((a: any) => ({ start: a.scheduledAt, end: a.endAt })),
            clinicWorkingDays: workingDaysConfig?.offDays || [0],
            clinicSchedules: workingDaysConfig?.schedules || []
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// GET /api/doctors/my-dashboard
export const getDoctorDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userEmail = req.user?.email;
        if (!userEmail) return res.status(403).json({ message: "Unauthorized" });

        // Look up doctor record by email
        const doctor = await prisma.doctor.findFirst({ where: { email: userEmail } });
        if (!doctor) return res.status(403).json({ message: "Not a doctor account" });
        const doctorId = doctor.id;

        const now = new Date();
        const last7Days = new Date(now);
        last7Days.setDate(last7Days.getDate() - 7);
        const prev7Days = new Date(last7Days);
        prev7Days.setDate(prev7Days.getDate() - 7);

        const [total, totalOnline, totalCancelled, uniquePatients,
            last7Total, prev7Total, last7Online, prev7Online, last7Cancelled, prev7Cancelled,
            totalScheduled, totalConfirmed, totalCheckedIn, totalCheckedOut, totalCompleted, todayApptsCount,
            recentAppointments, todayAppointment] = await Promise.all([
                prisma.appointment.count({ where: { doctorId } }),
                prisma.appointment.count({ where: { doctorId, appointmentType: { contains: "Online", mode: "insensitive" } } }),
                prisma.appointment.count({ where: { doctorId, status: "Cancelled" } }),
                prisma.appointment.groupBy({ by: ["patientId"], where: { doctorId } }),

                prisma.appointment.count({ where: { doctorId, scheduledAt: { gte: last7Days } } }),
                prisma.appointment.count({ where: { doctorId, scheduledAt: { gte: prev7Days, lt: last7Days } } }),
                prisma.appointment.count({ where: { doctorId, appointmentType: { contains: "Online", mode: "insensitive" }, scheduledAt: { gte: last7Days } } }),
                prisma.appointment.count({ where: { doctorId, appointmentType: { contains: "Online", mode: "insensitive" }, scheduledAt: { gte: prev7Days, lt: last7Days } } }),
                prisma.appointment.count({ where: { doctorId, status: "Cancelled", scheduledAt: { gte: last7Days } } }),
                prisma.appointment.count({ where: { doctorId, status: "Cancelled", scheduledAt: { gte: prev7Days, lt: last7Days } } }),

                // Status counts
                prisma.appointment.count({ where: { doctorId, status: "Scheduled" } }),
                prisma.appointment.count({ where: { doctorId, status: "Confirmed" } }),
                prisma.appointment.count({ where: { doctorId, status: "Checked In" } }),
                prisma.appointment.count({ where: { doctorId, status: "Checked Out" } }),
                prisma.appointment.count({ where: { doctorId, status: "Completed" } }),
                prisma.appointment.count({ where: { doctorId, scheduledAt: { gte: new Date(now.toDateString()), lt: new Date(new Date().setDate(now.getDate() + 1)) } } }),

                prisma.appointment.findMany({
                    where: { doctorId },
                    orderBy: { scheduledAt: "desc" },
                    take: 8,
                    include: {
                        patient: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
                    },
                }),

                prisma.appointment.findFirst({
                    where: {
                        doctorId,
                        scheduledAt: { gte: new Date(now.toDateString()) },
                    },
                    orderBy: { scheduledAt: "asc" },
                    include: {
                        patient: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
                        department: { select: { name: true } },
                    },
                }),
            ]);

        const pctChange = (curr: number, prev: number) => {
            if (prev === 0) return curr > 0 ? 100 : 0;
            return Math.round(((curr - prev) / prev) * 100);
        };

        res.json({
            stats: {
                totalAppointments: total,
                onlineConsultations: totalOnline,
                cancelledAppointments: totalCancelled,
                totalPatients: uniquePatients.length,
                totalChange: pctChange(last7Total, prev7Total),
                onlineChange: pctChange(last7Online, prev7Online),
                cancelledChange: pctChange(last7Cancelled, prev7Cancelled),
                todayAppointments: todayApptsCount,
                scheduled: totalScheduled,
                confirmed: totalConfirmed,
                checkedIn: totalCheckedIn,
                checkedOut: totalCheckedOut,
                completed: totalCompleted,
            },
            todayAppointment,
            recentAppointments: recentAppointments.map(a => ({
                id: a.id,
                patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}` : "Unknown",
                patientPhone: a.patient?.phone || "—",
                patientImage: a.patient?.profileImage || null,
                dateTime: a.scheduledAt,
                mode: a.appointmentType?.toLowerCase().includes("online") ? "Online" : "In-Person",
                status: a.status,
            })),
            doctorDetails: {
                id: doctor.id,
                departmentId: doctor.departmentId,
            }
        });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
