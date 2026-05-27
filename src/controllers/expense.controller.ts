import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const prisma = new PrismaClient();

// GET /api/expenses
export const getExpenses = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const expenses = await prisma.expense.findMany({
            where: { clinicId },
            orderBy: { date: "desc" },
        });

        res.json(expenses);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/expenses
export const createExpense = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { name, category, amount, date, purchasedBy, paymentMethod, status } = req.body;
        if (!name || !amount || !date) return res.status(400).json({ message: "Name, amount and date are required" });

        const expense = await prisma.expense.create({
            data: {
                name,
                category: category || "",
                amount: parseFloat(amount),
                date: new Date(date),
                purchasedBy: purchasedBy || "",
                paymentMethod: paymentMethod || "",
                status: status || "New",
                clinicId,
            },
        });

        res.status(201).json(expense);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/expenses/:id
export const updateExpense = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.expense.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Expense not found" });

        const { name, category, amount, date, purchasedBy, paymentMethod, status } = req.body;

        const updated = await prisma.expense.update({
            where: { id },
            data: {
                name,
                category,
                amount: amount !== undefined ? parseFloat(amount) : undefined,
                date: date ? new Date(date) : undefined,
                purchasedBy,
                paymentMethod,
                status,
            },
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/expenses/:id
export const deleteExpense = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.expense.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Expense not found" });

        await prisma.expense.delete({ where: { id } });
        res.json({ message: "Expense deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
