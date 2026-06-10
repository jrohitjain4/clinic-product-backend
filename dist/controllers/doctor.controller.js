"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDoctorDashboardStats = exports.getDoctorAvailability = exports.deleteDoctor = exports.updateDoctor = exports.createDoctor = exports.getDoctorById = exports.getDoctors = void 0;
const bcrypt = __importStar(require("bcryptjs"));
const crypto_1 = require("crypto");
const prisma_1 = __importDefault(require("../lib/prisma"));
const notification_controller_1 = require("./notification.controller");
const email_1 = require("../utils/email");
// GET /api/doctors
const getDoctors = async (req, res) => {
    try {
        const queryClinicId = req.query.clinicId;
        const clinicId = queryClinicId || req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const doctors = await prisma_1.default.doctor.findMany({
            where: { clinicId },
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(doctors);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getDoctors = getDoctors;
// GET /api/doctors/:id
const getDoctorById = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const doctor = await prisma_1.default.doctor.findFirst({
            where: { id, clinicId: clinicId },
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
                clinic: { select: { id: true, name: true } },
                specializations: { select: { id: true, name: true } },
            },
        });
        if (!doctor)
            return res.status(404).json({ message: "Doctor not found" });
        res.json(doctor);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getDoctorById = getDoctorById;
// POST /api/doctors
const createDoctor = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { fullName, username, phone, alternateMobile, email, dob, yearOfExperience, departmentId, designationId, specializations, // Array of specialization IDs
        medicalLicenseNumber, maritalStatus, qualification, languagesSpoken, bloodGroup, gender, bio, featureOnWebsite, profileImage, signatureImage, medicalRegCertificate, qualificationCertificate, aadhaarCard, aadhaarCardBack, panCard, address1, address2, country, city, state, pincode, appointmentType, acceptBookingsInAdvance, appointmentDuration, consultationCharge, maxBookingsPerSlot, displayOnBookingPage, followUpEnabled, followUpValidityDays, freeFollowUpLimit, followUpFee, educations, awards, certifications, schedules, } = req.body;
        if (!fullName)
            return res.status(400).json({ message: "Doctor name is required" });
        if (!email && !phone)
            return res.status(400).json({ message: "Email or Phone is required to create a doctor account" });
        // Check duplicates
        if (email) {
            const existingByEmail = await prisma_1.default.user.findFirst({ where: { email } });
            if (existingByEmail)
                return res.status(400).json({ message: "Email is already registered" });
        }
        if (phone) {
            const existingByPhone = await prisma_1.default.doctor.findFirst({ where: { phone, clinicId } });
            if (existingByPhone)
                return res.status(400).json({ message: "Phone number is already registered for another doctor" });
        }
        // Auto Doctor Code: DOC000001
        const doctorCount = await prisma_1.default.doctor.count({ where: { clinicId } });
        const doctorCode = `DOC${String(doctorCount + 1).padStart(6, "0")}`;
        const generatedPassword = req.body.password || (0, crypto_1.randomBytes)(4).toString("hex");
        console.log(`CREATING DOCTOR: ${fullName}`);
        console.log(`Generated Password: ${generatedPassword}`);
        const passwordHash = await bcrypt.hash(generatedPassword, 10);
        console.log(`Generated Hash: ${passwordHash}`);
        // Username defaults to phone if not provided
        const effectiveUsername = username || phone || null;
        const doctor = await prisma_1.default.$transaction(async (tx) => {
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
                        connect: specializations.map((id) => ({ id }))
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
                const frontendLink = process.env.FRONTEND_URL?.split(",")[0] || "http://localhost:5173";
                const loginUrl = `${frontendLink}/login`;
                const emailBody = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6;">
                    <h2 style="color: #2c3e50;">Welcome to Docyori, Dr. ${fullName}!</h2>
                    <p>You have been registered as a Doctor at our clinic. Your Doctor ID is <b style="color: #0d6efd;">${doctorCode}</b>.</p>
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #0d6efd;">
                      <p style="margin-top: 0;"><strong>Your Login Credentials:</strong></p>
                      <ul style="margin-bottom: 0;">
                        <li>Username: <strong>${effectiveUsername || email}</strong></li>
                        <li>Email: <strong>${email}</strong></li>
                        <li>Password: <strong>${generatedPassword}</strong></li>
                      </ul>
                    </div>
                    <p style="color: #dc3545; font-size: 14px; font-weight: bold;">
                      ⚠️ This is a temporary password. Please change it immediately after your first login.
                    </p>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${loginUrl}" style="background-color: #0d6efd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Click here to Login</a>
                    </div>
                    <p style="font-size: 13px; color: #6c757d;">Regards,<br/><strong>The Clinic Team</strong></p>
                  </div>`;
                await (0, email_1.sendEmail)(email.toLowerCase(), `Welcome to Docyori - Dr. ${fullName} Login Details`, emailBody);
            }
            catch (_) { /* non-blocking */ }
        }
        // 🔔 Notify admin: new doctor added
        try {
            await (0, notification_controller_1.createNotificationInternal)({
                clinicId,
                type: "DOCTOR_ADDED",
                title: "New Doctor Added",
                message: `Dr. ${fullName} (${doctorCode}) has been added to the clinic${email ? ` (${email})` : ""}.`,
                targetRole: "ADMIN",
                link: "/doctors/doctor-list",
            });
        }
        catch (_) { /* non-blocking */ }
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createDoctor = createDoctor;
// PUT /api/doctors/:id
const updateDoctor = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { fullName, username, phone, alternateMobile, email, dob, yearOfExperience, departmentId, designationId, specializations, medicalLicenseNumber, maritalStatus, qualification, languagesSpoken, bloodGroup, gender, bio, featureOnWebsite, profileImage, signatureImage, medicalRegCertificate, qualificationCertificate, aadhaarCard, aadhaarCardBack, panCard, address1, address2, country, city, state, pincode, appointmentType, acceptBookingsInAdvance, appointmentDuration, consultationCharge, maxBookingsPerSlot, displayOnBookingPage, followUpEnabled, followUpValidityDays, freeFollowUpLimit, followUpFee, educations, awards, certifications, schedules, status, } = req.body;
        const existing = await prisma_1.default.doctor.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Doctor not found" });
        const updatedDoctor = await prisma_1.default.doctor.update({
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
                    connect: specializations.map((sid) => ({ id: sid }))
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
                freeFollowUpLimit: freeFollowUpLimit ? parseInt(freeFollowUpLimit) : undefined,
                followUpFee: followUpFee !== undefined ? (followUpFee ? parseFloat(followUpFee) : null) : undefined,
                educations: educations || undefined,
                awards: awards || undefined,
                certifications: certifications || undefined,
                schedules: schedules || undefined,
                status,
            }
        });
        res.json(updatedDoctor);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateDoctor = updateDoctor;
const deleteDoctor = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.doctor.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Doctor not found" });
        await prisma_1.default.doctor.delete({ where: { id } });
        // 🔔 Notify on doctor removal
        try {
            await (0, notification_controller_1.createNotificationInternal)({
                clinicId: clinicId,
                type: "DOCTOR_ADDED",
                title: "Doctor Removed",
                message: `Dr. ${existing.fullName} has been removed from the clinic.`,
                targetRole: "ADMIN",
                link: "/doctors/doctor-list",
            });
        }
        catch (_) { /* non-blocking */ }
        res.json({ message: "Doctor deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteDoctor = deleteDoctor;
// GET /api/doctors/:id/availability
const getDoctorAvailability = async (req, res) => {
    try {
        const { id: doctorId } = req.params;
        const { startDate, endDate } = req.query;
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const doctor = await prisma_1.default.doctor.findUnique({
            where: { id: doctorId },
            select: { schedules: true, appointmentDuration: true, clinicId: true }
        });
        if (!doctor || doctor.clinicId !== clinicId) {
            return res.status(404).json({ message: "Doctor not found" });
        }
        const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const end = endDate ? new Date(endDate) : new Date(start.getFullYear(), start.getMonth() + 2, 0);
        // Fetch Holidays
        const holidays = await prisma_1.default.holiday.findMany({
            where: {
                clinicId,
                date: { gte: start, lte: end }
            }
        });
        // Fetch Leaves
        const leaves = await prisma_1.default.leave.findMany({
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
        const appointments = await prisma_1.default.appointment.findMany({
            where: {
                doctorId,
                scheduledAt: { gte: start, lte: end },
                status: { notIn: ["Cancelled", "Rejected"] }
            },
            select: { scheduledAt: true, endAt: true }
        });
        // Fetch Working Days Config
        const workingDaysConfig = await prisma_1.default.workingDaysConfig.findUnique({
            where: { clinicId }
        });
        res.json({
            schedules: doctor.schedules,
            duration: doctor.appointmentDuration || 30,
            holidays: holidays.map((h) => ({ date: h.date, endDate: h.endDate, title: h.title })),
            leaves: leaves.map((l) => ({ start: l.startDate, end: l.endDate })),
            appointments: appointments.map((a) => ({ start: a.scheduledAt, end: a.endAt })),
            clinicWorkingDays: workingDaysConfig?.offDays || [0],
            clinicSchedules: workingDaysConfig?.schedules || []
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getDoctorAvailability = getDoctorAvailability;
// GET /api/doctors/my-dashboard
const getDoctorDashboardStats = async (req, res) => {
    try {
        const userEmail = req.user?.email;
        if (!userEmail)
            return res.status(403).json({ message: "Unauthorized" });
        // Look up doctor record by email
        const doctor = await prisma_1.default.doctor.findFirst({ where: { email: userEmail } });
        if (!doctor)
            return res.status(403).json({ message: "Not a doctor account" });
        const doctorId = doctor.id;
        const now = new Date();
        const last7Days = new Date(now);
        last7Days.setDate(last7Days.getDate() - 7);
        const prev7Days = new Date(last7Days);
        prev7Days.setDate(prev7Days.getDate() - 7);
        const [total, totalOnline, totalCancelled, uniquePatients, last7Total, prev7Total, last7Online, prev7Online, last7Cancelled, prev7Cancelled, recentAppointments, todayAppointment] = await Promise.all([
            prisma_1.default.appointment.count({ where: { doctorId } }),
            prisma_1.default.appointment.count({ where: { doctorId, appointmentType: { contains: "Online", mode: "insensitive" } } }),
            prisma_1.default.appointment.count({ where: { doctorId, status: "Cancelled" } }),
            prisma_1.default.appointment.groupBy({ by: ["patientId"], where: { doctorId } }),
            prisma_1.default.appointment.count({ where: { doctorId, scheduledAt: { gte: last7Days } } }),
            prisma_1.default.appointment.count({ where: { doctorId, scheduledAt: { gte: prev7Days, lt: last7Days } } }),
            prisma_1.default.appointment.count({ where: { doctorId, appointmentType: { contains: "Online", mode: "insensitive" }, scheduledAt: { gte: last7Days } } }),
            prisma_1.default.appointment.count({ where: { doctorId, appointmentType: { contains: "Online", mode: "insensitive" }, scheduledAt: { gte: prev7Days, lt: last7Days } } }),
            prisma_1.default.appointment.count({ where: { doctorId, status: "Cancelled", scheduledAt: { gte: last7Days } } }),
            prisma_1.default.appointment.count({ where: { doctorId, status: "Cancelled", scheduledAt: { gte: prev7Days, lt: last7Days } } }),
            prisma_1.default.appointment.findMany({
                where: { doctorId },
                orderBy: { scheduledAt: "desc" },
                take: 8,
                include: {
                    patient: { select: { id: true, firstName: true, lastName: true, phone: true, profileImage: true } },
                },
            }),
            prisma_1.default.appointment.findFirst({
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
        const pctChange = (curr, prev) => {
            if (prev === 0)
                return curr > 0 ? 100 : 0;
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
        });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getDoctorDashboardStats = getDoctorDashboardStats;
