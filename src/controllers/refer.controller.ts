import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/refers
export const getRefers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const refers = await prisma.refer.findMany({
      where: { clinicId },
      orderBy: { createdAt: "desc" },
    });

    res.json(refers);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/refers
export const createRefer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "Refer name is required" });

    const refer = await prisma.refer.create({
      data: { name: name.trim(), description: description || null, clinicId },
    });

    res.status(201).json(refer);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/refers/:id
export const updateRefer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name?.trim()) return res.status(400).json({ message: "Refer name is required" });

    const existing = await prisma.refer.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Refer not found" });

    const updated = await prisma.refer.update({
      where: { id },
      data: { name: name.trim(), description: description || null },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/refers/:id
export const deleteRefer = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.refer.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Refer not found" });

    // Unlink patients before deleting
    await prisma.patient.updateMany({
      where: { referId: id, clinicId: clinicId! },
      data: { referId: null },
    });

    await prisma.refer.delete({ where: { id } });
    res.json({ message: "Refer deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
