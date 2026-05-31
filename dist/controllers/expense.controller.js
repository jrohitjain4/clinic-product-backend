"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpense = exports.updateExpense = exports.createExpense = exports.getExpenses = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/expenses
const getExpenses = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const expenses = await prisma_1.default.expense.findMany({
            where: { clinicId },
            orderBy: { date: "desc" },
        });
        res.json(expenses);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getExpenses = getExpenses;
// POST /api/expenses
const createExpense = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { name, category, amount, date, purchasedBy, paymentMethod, status } = req.body;
        if (!name || !amount || !date)
            return res.status(400).json({ message: "Name, amount and date are required" });
        const expense = await prisma_1.default.expense.create({
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
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createExpense = createExpense;
// PUT /api/expenses/:id
const updateExpense = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.expense.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Expense not found" });
        const { name, category, amount, date, purchasedBy, paymentMethod, status } = req.body;
        const updated = await prisma_1.default.expense.update({
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
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateExpense = updateExpense;
// DELETE /api/expenses/:id
const deleteExpense = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.expense.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Expense not found" });
        await prisma_1.default.expense.delete({ where: { id } });
        res.json({ message: "Expense deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteExpense = deleteExpense;
