import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/ipd/prescriptions
export const getIPDPrescriptions = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const admissionId = req.query.admissionId as string;
    const patientId = req.query.patientId as string;

    const prescriptions = await prisma.iPDPrescription.findMany({
      where: {
        clinicId,
        ...(admissionId ? { admissionId } : {}),
        ...(patientId ? { patientId } : {}),
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        doctor: { select: { id: true, fullName: true } },
        admission: { select: { id: true, admissionCode: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(prescriptions);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/prescriptions
export const createIPDPrescription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const {
      admissionId,
      dischargeSummary,
      medicineAdvice, // JSON array of [{ name, dosage, strength, frequency, duration, instructions }]
      images, // JSON array of ["url1", "url2"]
    } = req.body;

    if (!admissionId) {
      return res.status(400).json({ message: "Admission selection is required" });
    }

    const admission = await prisma.iPDAdmission.findFirst({
      where: { id: admissionId, clinicId },
    });

    if (!admission) {
      return res.status(404).json({ message: "Admission record not found" });
    }

    // Auto-generate prescription code
    const count = await prisma.iPDPrescription.count({ where: { clinicId } });
    const prescriptionCode = `IPD-PRSC-${String(count + 1).padStart(4, "0")}`;

    const prescription = await prisma.iPDPrescription.create({
      data: {
        prescriptionCode,
        admissionId,
        patientId: admission.patientId,
        doctorId: admission.doctorId,
        dischargeSummary: dischargeSummary || null,
        medicineAdvice: medicineAdvice ? JSON.parse(JSON.stringify(medicineAdvice)) : null,
        images: images ? JSON.parse(JSON.stringify(images)) : null,
        clinicId,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });

    res.status(201).json(prescription);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/ipd/prescriptions/:id
export const updateIPDPrescription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;
    const { dischargeSummary, medicineAdvice, images } = req.body;

    const prescription = await prisma.iPDPrescription.findFirst({
      where: { id, clinicId: clinicId! },
    });

    if (!prescription) {
      return res.status(404).json({ message: "IPD Prescription not found" });
    }

    const updated = await prisma.iPDPrescription.update({
      where: { id },
      data: {
        dischargeSummary: dischargeSummary !== undefined ? dischargeSummary : prescription.dischargeSummary,
        medicineAdvice: medicineAdvice !== undefined ? JSON.parse(JSON.stringify(medicineAdvice)) : prescription.medicineAdvice,
        images: images !== undefined ? JSON.parse(JSON.stringify(images)) : prescription.images,
      },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, patientCode: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/ipd/prescriptions/:id
export const deleteIPDPrescription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const prescription = await prisma.iPDPrescription.findFirst({
      where: { id, clinicId: clinicId! },
    });

    if (!prescription) {
      return res.status(404).json({ message: "IPD Prescription not found" });
    }

    await prisma.iPDPrescription.delete({
      where: { id },
    });

    res.json({ message: "IPD Prescription deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
