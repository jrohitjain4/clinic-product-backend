import { Response } from "express";
import { PrismaClient } from "@prisma/client";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";

const prisma = new PrismaClient();

// GET /api/holidays
export const getHolidays = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const holidays = await prisma.holiday.findMany({
            where: { clinicId },
            orderBy: { date: "asc" },
        });

        res.json(holidays);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/holidays — supports optional endDate for range
export const createHoliday = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "No clinic associated" });

        const { title, description, date, endDate, dayName } = req.body;
        if (!title || !date) return res.status(400).json({ message: "Title and Date are required" });

        // Create single record with optional endDate
        const newHoliday = await (prisma as any).holiday.create({
            data: {
                title,
                description: description || null,
                date: new Date(date),
                endDate: endDate ? new Date(endDate) : null,
                dayName: dayName || null,
                clinicId,
            },
        });

        res.status(201).json(newHoliday);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/holidays/:id
export const updateHoliday = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { title, description, date, endDate, dayName } = req.body;

        const existing = await (prisma as any).holiday.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Holiday not found" });

        const updated = await (prisma as any).holiday.update({
            where: { id },
            data: {
                title,
                description,
                date: date ? new Date(date) : undefined,
                endDate: endDate ? new Date(endDate) : null,
                dayName
            },
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};

// DELETE /api/holidays/:id
export const deleteHoliday = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;

        const existing = await (prisma as any).holiday.findFirst({ where: { id, clinicId: clinicId! } });
        if (!existing) return res.status(404).json({ message: "Holiday not found" });

        await (prisma as any).holiday.delete({ where: { id } });
        res.json({ message: "Holiday deleted successfully" });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
};
