"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteExpenseCategory = exports.updateExpenseCategory = exports.createExpenseCategory = exports.getExpenseCategories = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/expense-categories
const getExpenseCategories = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const categories = await prisma_1.default.expenseCategory.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });
        res.json(categories);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getExpenseCategories = getExpenseCategories;
// POST /api/expense-categories
const createExpenseCategory = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { name, status } = req.body;
        if (!name)
            return res.status(400).json({ message: "Category name is required" });
        const category = await prisma_1.default.expenseCategory.create({
            data: {
                name,
                status: status || "Active",
                clinicId,
            },
        });
        res.status(201).json(category);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createExpenseCategory = createExpenseCategory;
// PUT /api/expense-categories/:id
const updateExpenseCategory = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.expenseCategory.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Category not found" });
        const { name, status } = req.body;
        const updated = await prisma_1.default.expenseCategory.update({
            where: { id },
            data: {
                name,
                status,
            },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateExpenseCategory = updateExpenseCategory;
// DELETE /api/expense-categories/:id
const deleteExpenseCategory = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.expenseCategory.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Category not found" });
        await prisma_1.default.expenseCategory.delete({ where: { id } });
        res.json({ message: "Category deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteExpenseCategory = deleteExpenseCategory;
