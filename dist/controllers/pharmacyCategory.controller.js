"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeletePharmacyCategories = exports.deletePharmacyCategory = exports.updatePharmacyCategory = exports.createPharmacyCategory = exports.getPharmacyCategories = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/pharmacy-categories
const getPharmacyCategories = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const categories = await prisma_1.default.pharmacyCategory.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });
        res.json(categories);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getPharmacyCategories = getPharmacyCategories;
// POST /api/pharmacy-categories
const createPharmacyCategory = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { name, description, status } = req.body;
        if (!name)
            return res.status(400).json({ message: "Category name is required" });
        const category = await prisma_1.default.pharmacyCategory.create({
            data: {
                name,
                description: description || "",
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
exports.createPharmacyCategory = createPharmacyCategory;
// PUT /api/pharmacy-categories/:id
const updatePharmacyCategory = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.pharmacyCategory.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Category not found" });
        const { name, description, status } = req.body;
        const updated = await prisma_1.default.pharmacyCategory.update({
            where: { id },
            data: { name, description, status },
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updatePharmacyCategory = updatePharmacyCategory;
// DELETE /api/pharmacy-categories/:id
const deletePharmacyCategory = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.pharmacyCategory.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Category not found" });
        await prisma_1.default.pharmacyCategory.delete({ where: { id } });
        res.json({ message: "Category deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deletePharmacyCategory = deletePharmacyCategory;
// POST /api/pharmacy-categories/bulk-delete
const bulkDeletePharmacyCategories = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "ids array is required" });
        }
        await prisma_1.default.pharmacyCategory.deleteMany({
            where: { id: { in: ids }, clinicId },
        });
        res.json({ message: `${ids.length} categories deleted successfully` });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.bulkDeletePharmacyCategories = bulkDeletePharmacyCategories;
