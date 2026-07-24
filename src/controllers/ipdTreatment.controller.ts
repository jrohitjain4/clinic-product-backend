import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/ipd/treatments
export const getIPDTreatments = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const treatments = await prisma.iPDTreatment.findMany({
      where: { clinicId },
      include: {
        department: { select: { id: true, name: true } },
        categoryRef: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(treatments);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/ipd/treatments/:id
export const getIPDTreatmentById = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const treatment = await prisma.iPDTreatment.findFirst({
      where: { id, clinicId: clinicId! },
      include: {
        department: { select: { id: true, name: true } },
        categoryRef: { select: { id: true, name: true } },
      },
    });

    if (!treatment) return res.status(404).json({ message: "Treatment not found" });
    res.json(treatment);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/treatments
export const createIPDTreatment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const {
      procedureName,
      procedureCode,
      departmentId,
      categoryId,
      category,
      procedureFee,
      otCharges,
      anaesthesiaCharges,
      surgeonCharges,
      assistantSurgeonCharges,
      totalPrice,
      estimatedDuration,
      description,
    } = req.body;

    if (!procedureName) {
      return res.status(400).json({ message: "Procedure name is required" });
    }

    const pFee = procedureFee !== undefined && procedureFee !== "" ? parseFloat(procedureFee) : 0;
    const otFee = otCharges !== undefined && otCharges !== "" ? parseFloat(otCharges) : 0;
    const anFee = anaesthesiaCharges !== undefined && anaesthesiaCharges !== "" ? parseFloat(anaesthesiaCharges) : 0;
    const surgFee = surgeonCharges !== undefined && surgeonCharges !== "" ? parseFloat(surgeonCharges) : 0;
    const asstFee = assistantSurgeonCharges !== undefined && assistantSurgeonCharges !== "" ? parseFloat(assistantSurgeonCharges) : 0;

    // Direct input/override of Total Price if provided, else sum components
    const sumTotal = pFee + otFee + anFee + surgFee + asstFee;
    const finalTotal = totalPrice !== undefined && totalPrice !== null && totalPrice !== ""
      ? parseFloat(totalPrice)
      : sumTotal;

    // Auto-generate Procedure Code if not supplied: e.g. TRT0001
    let finalCode = procedureCode;
    if (!finalCode) {
      const count = await prisma.iPDTreatment.count({ where: { clinicId } });
      finalCode = `TRT${String(count + 1).padStart(4, "0")}`;
    }

    const treatment = await prisma.iPDTreatment.create({
      data: {
        procedureName,
        procedureCode: finalCode,
        departmentId: departmentId || null,
        categoryId: categoryId || null,
        category: category || "Minor Procedure",
        procedureFee: pFee,
        otCharges: otFee,
        anaesthesiaCharges: anFee,
        surgeonCharges: surgFee,
        assistantSurgeonCharges: asstFee,
        totalPrice: finalTotal,
        estimatedDuration: estimatedDuration || null,
        description: description || null,
        clinicId,
      },
      include: {
        department: { select: { id: true, name: true } },
        categoryRef: { select: { id: true, name: true } },
      },
    });

    res.status(201).json(treatment);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/ipd/treatments/:id
export const updateIPDTreatment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDTreatment.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Treatment not found" });

    const {
      procedureName,
      procedureCode,
      departmentId,
      categoryId,
      category,
      procedureFee,
      otCharges,
      anaesthesiaCharges,
      surgeonCharges,
      assistantSurgeonCharges,
      totalPrice,
      estimatedDuration,
      description,
      status,
    } = req.body;

    const pFee = procedureFee !== undefined && procedureFee !== "" ? parseFloat(procedureFee) : existing.procedureFee;
    const otFee = otCharges !== undefined && otCharges !== "" ? parseFloat(otCharges) : existing.otCharges;
    const anFee = anaesthesiaCharges !== undefined && anaesthesiaCharges !== "" ? parseFloat(anaesthesiaCharges) : existing.anaesthesiaCharges;
    const surgFee = surgeonCharges !== undefined && surgeonCharges !== "" ? parseFloat(surgeonCharges) : existing.surgeonCharges;
    const asstFee = assistantSurgeonCharges !== undefined && assistantSurgeonCharges !== "" ? parseFloat(assistantSurgeonCharges) : existing.assistantSurgeonCharges;

    const sumTotal = pFee + otFee + anFee + surgFee + asstFee;
    const finalTotal = totalPrice !== undefined && totalPrice !== null && totalPrice !== ""
      ? parseFloat(totalPrice)
      : sumTotal;

    const updated = await prisma.iPDTreatment.update({
      where: { id },
      data: {
        procedureName,
        procedureCode,
        departmentId: departmentId !== undefined ? (departmentId || null) : existing.departmentId,
        categoryId: categoryId !== undefined ? (categoryId || null) : existing.categoryId,
        category: category || existing.category,
        procedureFee: pFee,
        otCharges: otFee,
        anaesthesiaCharges: anFee,
        surgeonCharges: surgFee,
        assistantSurgeonCharges: asstFee,
        totalPrice: finalTotal,
        estimatedDuration,
        description,
        status,
      },
      include: {
        department: { select: { id: true, name: true } },
        categoryRef: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/ipd/treatments/:id
export const deleteIPDTreatment = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDTreatment.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Treatment not found" });

    await prisma.iPDTreatment.delete({ where: { id } });
    res.json({ message: "Treatment deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
