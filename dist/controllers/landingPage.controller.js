"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookPublicAppointment = exports.upsertLandingPage = exports.getClinicLandingPage = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_controller_1 = require("./notification.controller");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const crypto_1 = require("crypto");
const email_1 = require("../utils/email");
const getClinicLandingPage = async (req, res) => {
    try {
        const { clinicId, username } = req.params;
        const clinic = await prisma_1.default.clinic.findFirst({
            where: username ? { username } : { id: clinicId },
            include: {
                landingPage: true,
                doctors: {
                    where: { status: "Active" },
                    include: { specializations: true, designation: true, department: true },
                    orderBy: { createdAt: "asc" },
                },
                services: {
                    where: { status: "Active" },
                    include: { department: true },
                    orderBy: { serviceName: "asc" },
                },
                patients: { where: { status: { not: "Deleted" } }, select: { id: true } },
                workingDaysConfig: true,
            },
        });
        if (!clinic) {
            return res.status(404).json({ message: "Clinic not found" });
        }
        const lp = clinic.landingPage;
        const doctors = clinic.doctors.map((d) => ({
            id: d.id,
            name: d.fullName,
            qualification: d.designation?.name || "",
            specialization: d.specializations[0]?.name || "",
            experience: d.yearOfExperience || 0,
            fee: d.consultationCharge || 0,
            days: d.schedules
                ? (() => {
                    try {
                        const s = Array.isArray(d.schedules)
                            ? d.schedules
                            : [];
                        const activeDays = s
                            .filter((x) => x.isActive !== false)
                            .map((x) => x.day);
                        return activeDays.join(", ") || "Mon-Sat";
                    }
                    catch {
                        return "Mon-Sat";
                    }
                })()
                : "Mon-Sat",
            timing: "9 AM - 5 PM",
            photo: d.profileImage || "",
            bio: d.bio || "",
            phone: d.phone || "",
            email: d.email || "",
            medicalLicenseNumber: d.medicalLicenseNumber || "",
            languagesSpoken: d.languagesSpoken || [],
            bloodGroup: d.bloodGroup || "",
            gender: d.gender || "",
            dob: d.dob || null,
            educations: d.educations || [],
            awards: d.awards || [],
            certifications: d.certifications || [],
            schedules: d.schedules || [],
            clinicName: clinic.name,
            department: d.department?.name || "",
            designation: d.designation?.name || ""
        }));
        const services = lp?.services ??
            clinic.services.map((s) => ({
                icon: "ti ti-stethoscope",
                label: s.serviceName,
            }));
        const apptCount = await prisma_1.default.appointment.count({ where: { clinicId: clinic.id } });
        const nextAppointmentCode = `AP${String(apptCount + 1).padStart(3, "0")}`;
        const rawServices = clinic.services.map((s) => ({
            id: s.id,
            name: s.serviceName,
            price: s.price,
            departmentId: s.departmentId
        }));
        const response = {
            id: clinic.id,
            name: clinic.name,
            tagline: lp?.tagline || "Quality Healthcare for Your Family",
            phone: clinic.phone || "",
            whatsapp: lp?.whatsapp || clinic.phone || "",
            email: lp?.email || "",
            address: `${clinic.addressLine1 || ""} ${clinic.addressLine2 || ""}`.trim(),
            city: clinic.city || "",
            mapUrl: lp?.mapUrl || "",
            directionsUrl: lp?.directionsUrl || "",
            about: lp?.about || "",
            established: lp?.established || null,
            patientsServed: lp?.patientsServed || `${clinic.patients.length}+`,
            experience: lp?.experience || null,
            logo: lp?.logo || "",
            headerImage: lp?.headerImage || "",
            aboutImage: lp?.aboutImage || "",
            facebook: lp?.facebook || "",
            instagram: lp?.instagram || "",
            doctors,
            services,
            rawServices,
            reviews: lp?.reviews || [],
            gallery: lp?.gallery || [],
            workingDays: clinic.workingDaysConfig || null,
            onboardingStep: clinic.onboardingStep,
            nextAppointmentCode
        };
        return res.json(response);
    }
    catch (error) {
        console.error("Landing page error:", error);
        return res.status(500).json({ message: "Error fetching landing page" });
    }
};
exports.getClinicLandingPage = getClinicLandingPage;
/* ─── PUT /api/landing/:clinicId  (authenticated) ─── */
const upsertLandingPage = async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { tagline, whatsapp, email, facebook, instagram, about, established, patientsServed, experience, mapUrl, directionsUrl, reviews, gallery, services, logo, headerImage, aboutImage, } = req.body;
        const landingPage = await prisma_1.default.landingPage.upsert({
            where: { clinicId },
            create: {
                clinicId,
                tagline, whatsapp, email, facebook, instagram,
                about, established: established ? Number(established) : undefined,
                patientsServed, experience: experience ? Number(experience) : undefined,
                mapUrl, directionsUrl, reviews, gallery, services, logo,
                headerImage, aboutImage,
            },
            update: {
                tagline, whatsapp, email, facebook, instagram,
                about, established: established ? Number(established) : undefined,
                patientsServed, experience: experience ? Number(experience) : undefined,
                mapUrl, directionsUrl,
                ...(reviews !== undefined && { reviews }),
                ...(gallery !== undefined && { gallery }),
                ...(services !== undefined && { services }),
                ...(logo !== undefined && { logo }),
                ...(headerImage !== undefined && { headerImage }),
                ...(aboutImage !== undefined && { aboutImage }),
            },
        });
        return res.json({ success: true, landingPage });
    }
    catch (error) {
        console.error("Upsert landing page error:", error);
        return res.status(500).json({ message: "Error saving landing page" });
    }
};
exports.upsertLandingPage = upsertLandingPage;
/* ─── POST /api/landing/:clinicId/book  (public, no auth) ─── */
const bookPublicAppointment = async (req, res) => {
    try {
        const { clinicId } = req.params;
        const { firstName, lastName, email, phone, gender, doctorId, date, time, reason, appointmentType, serviceIds } = req.body;
        if (!firstName || !lastName || !email || !phone || !gender || !date || !time) {
            return res.status(400).json({ message: "First name, last name, email, phone, gender, date and time are required." });
        }
        const clinic = await prisma_1.default.clinic.findUnique({
            where: { id: clinicId },
            include: { workingDaysConfig: true }
        });
        if (!clinic)
            return res.status(404).json({ message: "Clinic not found" });
        // Validate Clinic Working Days
        const scheduledDate = new Date(date);
        const dayOfWeek = scheduledDate.getDay();
        const offDays = clinic.workingDaysConfig?.offDays || [0];
        if (offDays.includes(dayOfWeek)) {
            return res.status(400).json({ message: "The clinic is closed on this day. Please select another date." });
        }
        // Find or create patient by phone or email
        let patient = await prisma_1.default.patient.findFirst({
            where: {
                clinicId,
                OR: [
                    { phone },
                    { email: email.toLowerCase() }
                ]
            }
        });
        if (!patient) {
            const count = await prisma_1.default.patient.count({ where: { clinicId } });
            const patientCode = `PAT${String(count + 1).padStart(6, "0")}`;
            patient = await prisma_1.default.patient.create({
                data: {
                    patientCode,
                    firstName: firstName.trim(),
                    lastName: lastName.trim(),
                    phone,
                    email: email.toLowerCase(),
                    gender,
                    clinicId,
                    status: "Active",
                    dob: new Date("1990-01-01"),
                },
            });
        }
        // Check if user account already exists by email
        let existingUser = await prisma_1.default.user.findFirst({
            where: { email: email.toLowerCase() }
        });
        let generatedPassword = "";
        let isNewUserCreated = false;
        if (!existingUser) {
            // Check if phone number is already taken by another user account
            let phoneToUse = phone || null;
            if (phone) {
                const phoneTaken = await prisma_1.default.user.findFirst({
                    where: { phone }
                });
                if (phoneTaken) {
                    phoneToUse = null; // Prevent unique constraint crash by omitting duplicate phone
                }
            }
            generatedPassword = (0, crypto_1.randomBytes)(4).toString("hex"); // 8 chars hex password
            const passwordHash = await bcryptjs_1.default.hash(generatedPassword, 10);
            await prisma_1.default.user.create({
                data: {
                    email: email.toLowerCase(),
                    phone: phoneToUse,
                    username: email.toLowerCase(),
                    passwordHash,
                    fullName: `${firstName.trim()} ${lastName.trim()}`,
                    role: "PATIENT",
                    clinicId,
                }
            });
            isNewUserCreated = true;
        }
        // Resolve doctor
        let resolvedDoctorId = doctorId;
        if (!resolvedDoctorId) {
            const firstDoc = await prisma_1.default.doctor.findFirst({ where: { clinicId, status: "Active" } });
            if (!firstDoc)
                return res.status(400).json({ message: "No available doctors in this clinic." });
            resolvedDoctorId = firstDoc.id;
        }
        const doctor = await prisma_1.default.doctor.findFirst({ where: { id: resolvedDoctorId, clinicId } });
        if (!doctor)
            return res.status(400).json({ message: "Invalid doctor selected." });
        let timeStr = time;
        if (timeStr.split(':').length === 2) {
            timeStr = `${timeStr}:00`;
        }
        const scheduledAt = new Date(`${date}T${timeStr}`);
        if (isNaN(scheduledAt.getTime())) {
            return res.status(400).json({ message: "Invalid date or time format." });
        }
        const count = await prisma_1.default.appointment.count({ where: { clinicId } });
        const appointmentCode = `AP${String(count + 1).padStart(3, "0")}`;
        const appointment = await prisma_1.default.appointment.create({
            data: {
                appointmentCode,
                patientId: patient.id,
                doctorId: resolvedDoctorId,
                departmentId: doctor.departmentId || null,
                scheduledAt,
                endAt: null,
                mode: "Clinic Landing",
                appointmentType: appointmentType || "Online Booking",
                status: "Schedule",
                reason: reason || "Online booking from clinic website",
                location: null,
                clinicId,
                serviceIds: Array.isArray(serviceIds) ? serviceIds : [],
            },
        });
        // 🔴 P0 Email Notification with credentials and booking status
        await (0, email_1.sendPatientAppointmentEmail)(email.toLowerCase(), `${firstName.trim()} ${lastName.trim()}`, doctor.fullName, scheduledAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), time, appointmentCode, isNewUserCreated ? { username: email.toLowerCase(), password: generatedPassword } : undefined);
        // 🔴 P0 Email Notification for Doctor
        if (doctor.email) {
            try {
                await (0, email_1.sendDoctorAppointmentEmail)(doctor.email, doctor.fullName, `${firstName.trim()} ${lastName.trim()}`, scheduledAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), time, "Online Booking");
            }
            catch (emailErr) {
                console.error("Failed to send doctor appointment booking email:", emailErr);
            }
        }
        const patientName = `${patient.firstName} ${patient.lastName}`.trim();
        await (0, notification_controller_1.createNotificationInternal)({
            clinicId,
            type: "APPOINTMENT",
            title: "New Online Appointment Booked!",
            message: `${patientName} (${phone}) booked an appointment with Dr. ${doctor.fullName} on ${scheduledAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} at ${time}.`,
            targetRole: "ALL",
            link: `/appointments`,
        });
        return res.status(201).json({
            success: true,
            appointmentCode,
            isNewUserCreated,
            generatedPassword,
            email,
            patientCode: patient.patientCode,
            message: "Appointment booked successfully!",
        });
    }
    catch (error) {
        console.error("Public booking error:", error);
        return res.status(500).json({ message: "Error booking appointment. Please try again." });
    }
};
exports.bookPublicAppointment = bookPublicAppointment;
