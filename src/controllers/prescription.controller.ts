import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Get all prescriptions
export const getPrescriptions = async (req: Request, res: Response) => {
    try {
        const clinicId = (req as any).user?.clinicId;
        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }

        const prescriptions = await prisma.prescription.findMany({
            where: { clinicId },
            include: {
                patient: true,
                doctor: {
                    include: {
                        department: true
                    }
                },
                department: true,
                medicines: true,
            },
            orderBy: { createdAt: "desc" },
        });

        res.json(prescriptions);
    } catch (error) {
        console.error("Get Prescriptions Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Create a prescription
export const createPrescription = async (req: Request, res: Response) => {
    try {
        const clinicId = (req as any).user?.clinicId;
        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }

        const {
            patientId,
            doctorId,
            appointmentId,
            departmentId,
            advice,
            followUpDate,
            followUpNotes,
            medicines, // array of { medicineName, dosage, frequency, duration, timings }
        } = req.body;

        // Generate a unique prescription code
        const count = await prisma.prescription.count({ where: { clinicId } });
        const prescriptionCode = `#PRE${String(count + 1).padStart(3, "0")}`;

        const prescription = await prisma.prescription.create({
            data: {
                prescriptionCode,
                patientId,
                doctorId,
                appointmentId,
                departmentId,
                advice,
                followUpDate: followUpDate ? new Date(followUpDate) : null,
                followUpNotes,
                clinicId,
                medicines: {
                    create: medicines?.map((med: any) => ({
                        medicineName: med.medicineName,
                        dosage: med.dosage,
                        frequency: med.frequency,
                        duration: med.duration,
                        timings: med.timings,
                        clinicId,
                    })) || [],
                },
            },
            include: {
                medicines: true,
            },
        });

        res.status(201).json(prescription);
    } catch (error) {
        console.error("Create Prescription Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get a single prescription by ID
export const getPrescriptionById = async (req: Request, res: Response) => {
    try {
        const clinicId = (req as any).user?.clinicId;
        const { id } = req.params;

        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }

        const prescription = await prisma.prescription.findFirst({
            where: { id, clinicId },
            include: {
                patient: true,
                doctor: {
                    include: {
                        department: true,
                        designation: true
                    }
                },
                department: true,
                medicines: true,
                appointment: true
            },
        });

        if (!prescription) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        res.json(prescription);
    } catch (error) {
        console.error("Get Prescription Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update a prescription
export const updatePrescription = async (req: Request, res: Response) => {
    try {
        const clinicId = (req as any).user?.clinicId;
        const { id } = req.params;

        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }

        const {
            advice,
            followUpDate,
            followUpNotes,
            medicines,
        } = req.body;

        const existingPrescription = await prisma.prescription.findFirst({
            where: { id, clinicId },
        });

        if (!existingPrescription) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        // Since updating nested medicines logic is complex in Prisma (especially handling deletes/inserts properly for simple lists), 
        // it's easier to delete old ones and recreate for this use-case since they are tightly coupled.
        await prisma.prescriptionMedicine.deleteMany({
            where: { prescriptionId: id },
        });

        const updatedPrescription = await prisma.prescription.update({
            where: { id },
            data: {
                advice,
                followUpDate: followUpDate ? new Date(followUpDate) : null,
                followUpNotes,
                medicines: {
                    create: medicines?.map((med: any) => ({
                        medicineName: med.medicineName,
                        dosage: med.dosage,
                        frequency: med.frequency,
                        duration: med.duration,
                        timings: med.timings,
                        clinicId,
                    })) || [],
                },
            },
            include: {
                medicines: true,
            },
        });

        res.json(updatedPrescription);
    } catch (error) {
        console.error("Update Prescription Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Delete a prescription
export const deletePrescription = async (req: Request, res: Response) => {
    try {
        const clinicId = (req as any).user?.clinicId;
        const { id } = req.params;

        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }

        const existingPrescription = await prisma.prescription.findFirst({
            where: { id, clinicId },
        });

        if (!existingPrescription) {
            return res.status(404).json({ message: "Prescription not found" });
        }

        await prisma.prescription.delete({
            where: { id },
        });

        res.json({ message: "Prescription deleted successfully" });
    } catch (error) {
        console.error("Delete Prescription Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
