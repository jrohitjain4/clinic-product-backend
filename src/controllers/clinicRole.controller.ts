import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const prisma = new PrismaClient();

// GET /api/clinic-roles
export const getClinicRoles = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const roles = await prisma.clinicRole.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });

        res.json(roles);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};

// GET /api/clinic-roles/:id
export const getClinicRoleById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const role = await prisma.clinicRole.findFirst({
            where: { id, clinicId: clinicId! },
        });

        if (!role) return res.status(404).json({ message: "Role not found" });
        res.json(role);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};

// POST /api/clinic-roles
export const createClinicRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { name, permissions, status } = req.body;

        if (!name?.trim()) {
            return res.status(400).json({ message: "Role name is required" });
        }

        const newRole = await prisma.clinicRole.create({
            data: {
                name: name.trim(),
                permissions: permissions || {},
                status: status || "Active",
                clinicId,
            },
        });

        res.status(201).json(newRole);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};

// PUT /api/clinic-roles/:id
export const updateClinicRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.clinicRole.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Role not found" });

        const { name, permissions, status } = req.body;

        const updated = await prisma.clinicRole.update({
            where: { id },
            data: {
                name: name !== undefined ? name.trim() : existing.name,
                permissions: permissions !== undefined ? permissions : existing.permissions,
                status: status ?? existing.status,
            },
        });

        res.json(updated);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};

// DELETE /api/clinic-roles/:id
export const deleteClinicRole = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await prisma.clinicRole.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Role not found" });

        await prisma.clinicRole.delete({ where: { id } });
        res.json({ message: "Role deleted successfully" });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Server error";
        res.status(500).json({ message });
    }
};
