import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";


// GET /api/products
export const getProducts = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const products = await prisma.product.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });

        res.json(products);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/products
export const createProduct = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { name, description, price, key } = req.body;

        if (!name || price === undefined) {
            return res.status(400).json({ message: "Name and Price are required" });
        }

        const newProduct = await prisma.product.create({
            data: {
                name,
                description,
                price: parseFloat(price),
                key: key || null,
                clinicId,
            }
        });

        res.status(201).json(newProduct);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/products/:id
export const updateProduct = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { name, description, price, key } = req.body;

        const existing = await prisma.product.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Product not found" });

        const updated = await prisma.product.update({
            where: { id },
            data: {
                name,
                description,
                price: price !== undefined ? parseFloat(price) : undefined,
                key: key !== undefined ? (key || null) : undefined,
            }
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/products/:id
export const deleteProduct = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.product.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Product not found" });

        await prisma.product.delete({ where: { id } });
        res.json({ message: "Product deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
