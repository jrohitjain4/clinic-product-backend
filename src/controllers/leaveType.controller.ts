import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const prisma = new PrismaClient() as any;

export const createLeaveType = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated with your account" });

        const { name, quota, status } = req.body;
        if (!name || quota === undefined) {
            return res.status(400).json({ message: "Name and Quota are required" });
        }

        const leaveType = await prisma.leaveType.create({
            data: {
                name,
                quota: parseInt(quota, 10),
                status: status || "Active",
                clinicId,
            },
        });
        res.status(201).json(leaveType);
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to create leave type" });
    }
};

export const getLeaveTypes = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated with your account" });

        const leaveTypes = await prisma.leaveType.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });
        res.json(leaveTypes);
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to fetch leave types" });
    }
};

export const updateLeaveType = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated with your account" });

        const { id } = req.params;
        const { name, quota, status } = req.body;

        const dataToUpdate: any = {};
        if (name) dataToUpdate.name = name;
        if (quota !== undefined) dataToUpdate.quota = parseInt(quota, 10);
        if (status) dataToUpdate.status = status;

        const leaveType = await prisma.leaveType.updateMany({
            where: { id, clinicId },
            data: dataToUpdate,
        });

        res.json({ message: "Leave type updated successfully", updated: leaveType.count > 0 });
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to update leave type" });
    }
};

export const deleteLeaveType = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated with your account" });

        const { id } = req.params;

        const leaveType = await prisma.leaveType.deleteMany({
            where: { id, clinicId },
        });

        res.json({ message: "Leave type deleted successfully", deleted: leaveType.count > 0 });
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to delete leave type" });
    }
};
