import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/ipd/categories
export const getIPDCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const categories = await prisma.iPDCategory.findMany({
      where: { clinicId },
      include: {
        _count: { select: { treatments: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(categories);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/ipd/categories
export const createIPDCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

    const { name, description } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Category name is required" });
    }

    const category = await prisma.iPDCategory.create({
      data: {
        name: name.trim(),
        description: description ? description.trim() : null,
        clinicId,
      },
    });

    res.status(201).json(category);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/ipd/categories/:id
export const updateIPDCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;
    const { name, description, status } = req.body;

    const existing = await prisma.iPDCategory.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Category not found" });

    const updated = await prisma.iPDCategory.update({
      where: { id },
      data: {
        name: name ? name.trim() : existing.name,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
        status: status || existing.status,
      },
    });

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/ipd/categories/:id
export const deleteIPDCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const clinicId = req.user?.clinicId;
    const { id } = req.params;

    const existing = await prisma.iPDCategory.findFirst({ where: { id, clinicId: clinicId! } });
    if (!existing) return res.status(404).json({ message: "Category not found" });

    await prisma.iPDCategory.delete({ where: { id } });
    res.json({ message: "Category deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};
