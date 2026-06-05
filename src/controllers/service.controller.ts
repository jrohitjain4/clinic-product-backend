import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";


// GET /api/services
export const getServices = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const services = await prisma.service.findMany({
            where: { clinicId },
            include: {
                department: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        res.json(services);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/services
export const createService = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { serviceName, departmentId, price, status } = req.body;

        if (!serviceName || !departmentId) {
            return res.status(400).json({ message: "Service Name and Department are required" });
        }

        const newService = await prisma.service.create({
            data: {
                serviceName,
                departmentId,
                price: price !== undefined && price !== null && price !== "" ? parseFloat(price) : undefined,
                status: status || "Active",
                clinicId,
            },
            include: {
                department: true,
            }
        });

        res.status(201).json(newService);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/services/:id
export const updateService = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { serviceName, departmentId, price, status } = req.body;

        const existing = await prisma.service.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Service not found" });

        const updated = await prisma.service.update({
            where: { id },
            data: {
                serviceName,
                departmentId,
                price: price !== undefined ? parseFloat(price) : undefined,
                status,
            },
            include: {
                department: true,
            }
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/services/:id
export const deleteService = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.service.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Service not found" });

        await prisma.service.delete({ where: { id } });
        res.json({ message: "Service deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
