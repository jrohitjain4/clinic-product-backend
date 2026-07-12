"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePrescription = exports.updatePrescription = exports.getPrescriptionById = exports.createPrescription = exports.getPrescriptions = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// Get all prescriptions
const getPrescriptions = async (req, res) => {
    try {
        const user = req.user;
        const clinicId = user?.clinicId;
        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }
        let patientIdFilter = undefined;
        if (user.role === 'PATIENT' && user.email) {
            const loggedInPatient = await prisma_1.default.patient.findFirst({
                where: { email: user.email, clinicId },
            });
            if (loggedInPatient) {
                patientIdFilter = loggedInPatient.id;
            }
            else {
                return res.json([]);
            }
        }
        const prescriptions = await prisma_1.default.prescription.findMany({
            where: {
                clinicId,
                ...(patientIdFilter ? { patientId: patientIdFilter } : {})
            },
            include: {
                patient: true,
                doctor: {
                    include: {
                        department: true
                    }
                },
                department: true,
                medicines: true,
                appointment: true,
                clinic: {
                    include: { landingPage: true }
                }
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(prescriptions);
    }
    catch (error) {
        console.error("Get Prescriptions Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPrescriptions = getPrescriptions;
// Create a prescription
const createPrescription = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }
        const { patientId, doctorId, appointmentId, departmentId, advice, followUpDate, followUpNotes, medicines, // array of { medicineName, dosage, frequency, duration, timings }
        diagnosticTests, // array of string names or test details
         } = req.body;
        // Enforce one-prescription-per-appointment rule
        if (appointmentId) {
            const existing = await prisma_1.default.prescription.findFirst({
                where: { appointmentId, clinicId },
            });
            if (existing) {
                return res.status(409).json({
                    message: "A prescription already exists for this appointment. Please edit the existing prescription.",
                    existingId: existing.id,
                });
            }
        }
        // Generate a unique prescription code
        const count = await prisma_1.default.prescription.count({ where: { clinicId } });
        const prescriptionCode = `#PRE${String(count + 1).padStart(3, "0")}`;
        const prescription = await prisma_1.default.prescription.create({
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
                diagnosticTests: diagnosticTests || null,
                medicines: {
                    create: medicines?.map((med) => ({
                        medicineName: med.medicineName,
                        dosage: med.dosage,
                        strength: med.strength || null,
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
    }
    catch (error) {
        console.error("Create Prescription Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.createPrescription = createPrescription;
// Get a single prescription by ID
const getPrescriptionById = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }
        const user = req.user;
        let patientIdFilter = undefined;
        if (user.role === 'PATIENT' && user.email) {
            const loggedInPatient = await prisma_1.default.patient.findFirst({
                where: { email: user.email, clinicId },
            });
            if (loggedInPatient) {
                patientIdFilter = loggedInPatient.id;
            }
            else {
                return res.status(404).json({ message: "Patient not found" });
            }
        }
        const prescription = await prisma_1.default.prescription.findFirst({
            where: {
                id,
                clinicId,
                ...(patientIdFilter ? { patientId: patientIdFilter } : {})
            },
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
                appointment: true,
                clinic: {
                    include: { landingPage: true }
                }
            },
        });
        if (!prescription) {
            return res.status(404).json({ message: "Prescription not found" });
        }
        res.json(prescription);
    }
    catch (error) {
        console.error("Get Prescription Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.getPrescriptionById = getPrescriptionById;
// Update a prescription
const updatePrescription = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }
        const { advice, followUpDate, followUpNotes, medicines, diagnosticTests, } = req.body;
        const existingPrescription = await prisma_1.default.prescription.findFirst({
            where: { id, clinicId },
        });
        if (!existingPrescription) {
            return res.status(404).json({ message: "Prescription not found" });
        }
        // Since updating nested medicines logic is complex in Prisma (especially handling deletes/inserts properly for simple lists), 
        // it's easier to delete old ones and recreate for this use-case since they are tightly coupled.
        await prisma_1.default.prescriptionMedicine.deleteMany({
            where: { prescriptionId: id },
        });
        const updatedPrescription = await prisma_1.default.prescription.update({
            where: { id },
            data: {
                advice,
                followUpDate: followUpDate ? new Date(followUpDate) : null,
                followUpNotes,
                diagnosticTests: diagnosticTests || null,
                medicines: {
                    create: medicines?.map((med) => ({
                        medicineName: med.medicineName,
                        dosage: med.dosage,
                        strength: med.strength || null,
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
    }
    catch (error) {
        console.error("Update Prescription Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.updatePrescription = updatePrescription;
// Delete a prescription
const deletePrescription = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        if (!clinicId) {
            return res.status(403).json({ message: "Clinic ID is required" });
        }
        const existingPrescription = await prisma_1.default.prescription.findFirst({
            where: { id, clinicId },
        });
        if (!existingPrescription) {
            return res.status(404).json({ message: "Prescription not found" });
        }
        await prisma_1.default.prescription.delete({
            where: { id },
        });
        res.json({ message: "Prescription deleted successfully" });
    }
    catch (error) {
        console.error("Delete Prescription Error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
exports.deletePrescription = deletePrescription;
