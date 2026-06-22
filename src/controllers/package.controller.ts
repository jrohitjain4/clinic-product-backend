import { Request, Response } from "express";
import prisma from "../lib/prisma";


export const getPackages = async (req: Request, res: Response) => {
    try {
        const packages = await prisma.subscriptionPackage.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return res.json(packages);
    } catch (error) {
        return res.status(500).json({ message: "Error fetching packages" });
    }
};

export const createPackage = async (req: Request, res: Response) => {
    try {
        const { name, price, durationInDays } = req.body;

        const newPackage = await prisma.subscriptionPackage.create({
            data: {
                name,
                price: parseFloat(price),
                durationInDays: parseInt(durationInDays),
                isActive: true
            }
        });

        return res.status(201).json(newPackage);
    } catch (error) {
        console.error("Create package error:", error);
        return res.status(500).json({ message: "Error creating package" });
    }
};

export const updatePackage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, price, durationInDays, isActive } = req.body;

        const updated = await prisma.subscriptionPackage.update({
            where: { id },
            data: {
                name,
                price: price ? parseFloat(price) : undefined,
                durationInDays: durationInDays ? parseInt(durationInDays) : undefined,
                isActive
            }
        });

        return res.json(updated);
    } catch (error) {
        return res.status(500).json({ message: "Error updating package" });
    }
};

export const deletePackage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.subscriptionPackage.delete({ where: { id } });
        return res.json({ message: "Package deleted successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Error deleting package" });
    }
};
