import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// GET /api/doctors
export const getDoctors = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
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
            specializationId,
            medicalLicenseNumber,
            languagesSpoken,
            bloodGroup,
            gender,
            bio,
            featureOnWebsite,
            profileImage,
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
            educations,
            awards,
            certifications,
            schedules,
        } = req.body;

        if (!fullName) return res.status(400).json({ message: "Doctor name is required" });
        if (!email) return res.status(400).json({ message: "Email is required to create a doctor account" });

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) return res.status(400).json({ message: "Email is already registered" });

        const passwordHash = await bcrypt.hash("doctor123", 10);

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
                    specializationId: specializationId || null,
                    medicalLicenseNumber: medicalLicenseNumber || null,
                    languagesSpoken: languagesSpoken || [],
                    bloodGroup: bloodGroup || null,
                    gender: gender || null,
                    bio: bio || null,
                    featureOnWebsite: featureOnWebsite === true || featureOnWebsite === "true",
                    profileImage: profileImage || null,
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
                    specialization: { select: { id: true, name: true } },
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
            departmentId, designationId, specializationId, medicalLicenseNumber, languagesSpoken,
            bloodGroup, gender, bio, featureOnWebsite, profileImage,
            address1, address2, country, city, state, pincode,
            appointmentType, acceptBookingsInAdvance, appointmentDuration,
            consultationCharge, maxBookingsPerSlot, displayOnBookingPage,
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
                specializationId: specializationId !== undefined ? (specializationId || null) : existing.specializationId,
                medicalLicenseNumber: medicalLicenseNumber !== undefined ? (medicalLicenseNumber || null) : existing.medicalLicenseNumber,
                languagesSpoken: languagesSpoken ?? existing.languagesSpoken,
                bloodGroup: bloodGroup !== undefined ? (bloodGroup || null) : existing.bloodGroup,
                gender: gender !== undefined ? (gender || null) : existing.gender,
                bio: bio !== undefined ? (bio || null) : existing.bio,
                featureOnWebsite: featureOnWebsite !== undefined
                    ? featureOnWebsite === true || featureOnWebsite === "true"
                    : existing.featureOnWebsite,
                profileImage: profileImage !== undefined ? (profileImage || null) : existing.profileImage,
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
                educations: educations || null,
                awards: awards || null,
                certifications: certifications || null,
                schedules: schedules || null,
                status: status || "Active",
            },
            include: {
                department: { select: { id: true, name: true } },
                designation: { select: { id: true, name: true } },
                specialization: { select: { id: true, name: true } },
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
        res.json({ message: "Doctor deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
