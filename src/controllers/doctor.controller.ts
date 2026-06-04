import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import prisma from "../lib/prisma";
import { createNotificationInternal } from "./notification.controller";
import { sendEmail } from "../utils/email";

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
        const passwordHash = await bcrypt.hash(generatedPassword, 10);
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
                await sendEmail(email.toLowerCase(), `Welcome to Docyori - Dr. ${fullName} Login Details`, emailBody);
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

        const existing = await prisma.doctor.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Doctor not found" });

        const {
            fullName, username, phone, email, dob, yearOfExperience,
            departmentId, designationId, specializations, medicalLicenseNumber, languagesSpoken,
            maritalStatus, qualification,
            bloodGroup, gender, bio, featureOnWebsite,
            profileImage, signatureImage, medicalRegCertificate, qualificationCertificate, aadhaarCard, panCard,
            address1, address2, country, city, state, pincode,
            appointmentType, acceptBookingsInAdvance, appointmentDuration,
            consultationCharge, maxBookingsPerSlot, displayOnBookingPage,
            followUpEnabled, followUpValidityDays, freeFollowUpLimit,
            educations, awards, certifications, schedules, status,
        } = req.body;

        const updated = await prisma.doctor.update({
            where: { id },
            data: {
                fullName: fullName ?? existing.fullName,
                username: username !== undefined ? (username || null) : existing.username,
                phone: phone !== undefined ? (phone || null) : existing.phone,
                email: email !== undefined ? (email || null) : existing.email,
                dob: dob ? new Date(dob) : existing.dob,
                yearOfExperience: yearOfExperience ? parseInt(yearOfExperience) : existing.yearOfExperience,
                departmentId: departmentId !== undefined ? (departmentId || null) : existing.departmentId,
                designationId: designationId !== undefined ? (designationId || null) : existing.designationId,
                specializations: specializations ? {
                    set: [], // clears existing
                    connect: specializations.map((id: string) => ({ id }))
                } : undefined,
                medicalLicenseNumber: medicalLicenseNumber !== undefined ? (medicalLicenseNumber || null) : existing.medicalLicenseNumber,
                maritalStatus: maritalStatus !== undefined ? (maritalStatus || null) : existing.maritalStatus,
                qualification: qualification !== undefined ? (qualification || null) : existing.qualification,
                languagesSpoken: languagesSpoken ?? existing.languagesSpoken,
                bloodGroup: bloodGroup !== undefined ? (bloodGroup || null) : existing.bloodGroup,
                gender: gender !== undefined ? (gender || null) : existing.gender,
                bio: bio !== undefined ? (bio || null) : existing.bio,
                featureOnWebsite: featureOnWebsite !== undefined
                    ? featureOnWebsite === true || featureOnWebsite === "true"
                    : existing.featureOnWebsite,
                profileImage: profileImage !== undefined ? (profileImage || null) : existing.profileImage,
                signatureImage: signatureImage !== undefined ? (signatureImage || null) : existing.signatureImage,
                medicalRegCertificate: medicalRegCertificate !== undefined ? (medicalRegCertificate || null) : existing.medicalRegCertificate,
                qualificationCertificate: qualificationCertificate !== undefined ? (qualificationCertificate || null) : existing.qualificationCertificate,
                aadhaarCard: aadhaarCard !== undefined ? (aadhaarCard || null) : existing.aadhaarCard,
                panCard: panCard !== undefined ? (panCard || null) : existing.panCard,
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
                followUpEnabled: followUpEnabled !== undefined
                    ? followUpEnabled === true || followUpEnabled === "true"
                    : existing.followUpEnabled,
                followUpValidityDays: followUpValidityDays ? parseInt(followUpValidityDays) : existing.followUpValidityDays,
                freeFollowUpLimit: freeFollowUpLimit !== undefined ? (freeFollowUpLimit === "" ? null : parseInt(freeFollowUpLimit)) : existing.freeFollowUpLimit,
                educations: educations || null,
                awards: awards || null,
                certifications: certifications || null,
                schedules: schedules || null,
                status: status || "Active",
            },
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
                specializations: { select: { id: true, name: true } },
            },
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/doctors/:id
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
