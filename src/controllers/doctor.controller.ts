import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import prisma from "../lib/prisma";
import { createNotificationInternal } from "./notification.controller";

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
        if (!email) return res.status(400).json({ message: "Email is required to create a doctor account" });

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ message: "Email is already registered" });

        const temporaryPassword = req.body.password || "doctor123";
        const passwordHash = await bcrypt.hash(temporaryPassword, 10);

        const doctor = await prisma.$transaction(async (tx) => {
            const newDoctor = await tx.doctor.create({
                data: {
                    fullName,
                    username: username || null,
                    phone: phone || null,
                    email: email || null,
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

            await tx.user.create({
                data: {
                    email,
                    passwordHash,
                    fullName,
                    role: "DOCTOR",
                    clinicId,
                }
            });

            return newDoctor;
        });

        res.status(201).json(doctor);

        // 🔔 Notify admin: new doctor added
        try {
            await createNotificationInternal({
                clinicId,
                type: "DOCTOR_ADDED",
                title: "New Doctor Added",
                message: `Dr. ${fullName} has been added to the clinic${email ? ` (${email})` : ""}.`,
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
