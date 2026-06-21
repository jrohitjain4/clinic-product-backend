"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteProduct = exports.updateProduct = exports.createProduct = exports.getProducts = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/products
const getProducts = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const products = await prisma_1.default.product.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });
        res.json(products);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getProducts = getProducts;
// POST /api/products
const createProduct = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { name, description, price, key } = req.body;
        if (!name || price === undefined) {
            return res.status(400).json({ message: "Name and Price are required" });
        }
        const newProduct = await prisma_1.default.product.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                key: key || null,
                clinicId,
            }
        });
        res.status(201).json(newProduct);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createProduct = createProduct;
// PUT /api/products/:id
const updateProduct = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { name, description, price, key } = req.body;
        const existing = await prisma_1.default.product.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Product not found" });
        const updated = await prisma_1.default.product.update({
            where: { id },
            data: {
                name,
                description,
                price: price !== undefined ? parseFloat(price) : undefined,
                key: key !== undefined ? (key || null) : undefined,
            }
        });
        res.json(updated);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateProduct = updateProduct;
// DELETE /api/products/:id
const deleteProduct = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.product.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Product not found" });
        await prisma_1.default.product.delete({ where: { id } });
        res.json({ message: "Product deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteProduct = deleteProduct;
