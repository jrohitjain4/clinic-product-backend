import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/pharmacy-categories
export const getPharmacyCategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const categories = await prisma.pharmacyCategory.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });

        res.json(categories);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/pharmacy-categories
export const createPharmacyCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { name, description, status } = req.body;
        if (!name) return res.status(400).json({ message: "Category name is required" });

        const category = await prisma.pharmacyCategory.create({
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

// PUT /api/pharmacy-categories/:id
export const updatePharmacyCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.pharmacyCategory.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Category not found" });

        const { name, description, status } = req.body;

        const updated = await prisma.pharmacyCategory.update({
            where: { id },
            data: { name, description, status },
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/pharmacy-categories/:id
export const deletePharmacyCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.pharmacyCategory.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Category not found" });

        await prisma.pharmacyCategory.delete({ where: { id } });
        res.json({ message: "Category deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/pharmacy-categories/bulk-delete
export const bulkDeletePharmacyCategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "ids array is required" });
        }

        await prisma.pharmacyCategory.deleteMany({
            where: { id: { in: ids }, clinicId },
        });

        res.json({ message: `${ids.length} categories deleted successfully` });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
