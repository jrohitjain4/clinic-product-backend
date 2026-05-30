import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";


// GET /api/expense-categories
export const getExpenseCategories = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const categories = await prisma.expenseCategory.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });

        res.json(categories);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/expense-categories
export const createExpenseCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { name, status } = req.body;
        if (!name) return res.status(400).json({ message: "Category name is required" });

        const category = await prisma.expenseCategory.create({
            data: {
                name,
                status: status || "Active",
                clinicId,
            },
        });

        res.status(201).json(category);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/expense-categories/:id
export const updateExpenseCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.expenseCategory.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Category not found" });

        const { name, status } = req.body;

        const updated = await prisma.expenseCategory.update({
            where: { id },
            data: {
                name,
                status,
            },
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/expense-categories/:id
export const deleteExpenseCategory = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.expenseCategory.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Category not found" });

        await prisma.expenseCategory.delete({ where: { id } });
        res.json({ message: "Category deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
