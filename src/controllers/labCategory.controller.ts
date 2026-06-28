import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/lab-categories
export const getLabCategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const categories = await prisma.labCategory.findMany({
            where: { clinicId },
            include: { _count: { select: { tests: true } } },
            orderBy: { createdAt: "desc" },
        });

        res.json(categories);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/lab-categories
export const createLabCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { name, description, status } = req.body;
        if (!name) return res.status(400).json({ message: "Category name is required" });

        const category = await prisma.labCategory.create({
            data: {
                name,
                description: description || "",
                status: status || "Active",
                clinicId,
            },
        });

        res.status(201).json(category);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/lab-categories/:id
export const updateLabCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.labCategory.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Category not found" });

        const { name, description, status } = req.body;

        const updated = await prisma.labCategory.update({
            where: { id },
            data: { name, description, status },
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/lab-categories/:id
export const deleteLabCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.labCategory.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Category not found" });

        await prisma.labCategory.delete({ where: { id } });
        res.json({ message: "Category deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/lab-categories/bulk
export const bulkDeleteLabCategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "ids array is required" });
        }

        await prisma.labCategory.deleteMany({
            where: { id: { in: ids }, clinicId },
        });

        res.json({ message: `${ids.length} categories deleted successfully` });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
