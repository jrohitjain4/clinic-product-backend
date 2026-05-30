import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

// GET /api/designations
export const getDesignations = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { departmentId, type } = req.query;

        const designations = await prisma.designation.findMany({
            where: {
                clinicId,
                status: "Active",
                ...(departmentId && typeof departmentId === "string"
                    ? { departmentId }
                    : {}),
                ...(type && typeof type === "string" ? { type } : {}),
            },
            include: { department: { select: { id: true, name: true } } },
            orderBy: { name: "asc" },
        });

        const result = designations.map((d) => ({
            id: d.id,
            name: d.name,
            type: d.type,
            description: d.description,
            status: d.status,
            departmentId: d.departmentId,
            departmentName: d.department?.name ?? null,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
        }));

        res.json(result);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/designations
export const createDesignation = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { name, type, description, departmentId } = req.body;
        if (!name) return res.status(400).json({ message: "Designation name is required" });
        if (!departmentId) return res.status(400).json({ message: "Department is required" });

        const designation = await prisma.designation.create({
            data: {
                name,
                type: type || "Staff",
                description,
                departmentId,
                clinicId,
                status: "Active",
            },
            include: { department: { select: { id: true, name: true } } },
        });

        res.status(201).json(designation);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/designations/:id
export const updateDesignation = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { name, type, description, departmentId, status } = req.body;

        const existing = await prisma.designation.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Designation not found" });

        const updated = await prisma.designation.update({
            where: { id },
            data: { name, type, description, departmentId, status },
            include: { department: { select: { id: true, name: true } } },
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/designations/:id
export const deleteDesignation = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.designation.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Designation not found" });

        await prisma.designation.delete({ where: { id } });
        res.json({ message: "Designation deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
