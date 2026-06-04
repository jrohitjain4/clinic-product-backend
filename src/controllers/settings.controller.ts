import { Response } from "express";
import { AuthenticatedRequest } from "../middlewares/auth.middleware";
import prisma from "../lib/prisma";

export const getWorkingDaysConfig = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "Clinic not found" });

        let config = await prisma.workingDaysConfig.findUnique({
            where: { clinicId }
        });

        if (!config) {
            const initialSchedules = [0, 1, 2, 3, 4, 5, 6].map(d => ({
                day: d,
                startTime: "09:00",
                endTime: "18:00",
                isActive: d !== 0 // Sunday off by default
            }));

            config = await prisma.workingDaysConfig.create({
                data: {
                    clinicId,
                    offDays: [0],
                    schedules: initialSchedules
                }
            });
        } else if (!config.schedules || (Array.isArray(config.schedules) && config.schedules.length === 0)) {
            // Migrating existing config to include schedules
            const schedules = [0, 1, 2, 3, 4, 5, 6].map(d => ({
                day: d,
                startTime: "09:00",
                endTime: "18:00",
                isActive: !config?.offDays.includes(d)
            }));
            config = await prisma.workingDaysConfig.update({
                where: { id: config.id },
                data: { schedules }
            });
        }

        res.json(config);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateWorkingDaysConfig = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId) return res.status(403).json({ message: "Clinic not found" });

        const { offDays, schedules } = req.body;

        const updateData: any = {};
        if (Array.isArray(offDays)) updateData.offDays = offDays;
        if (schedules) updateData.schedules = schedules;

        const config = await prisma.workingDaysConfig.upsert({
            where: { clinicId },
            create: {
                clinicId,
                offDays: offDays || [0],
                schedules: schedules || []
            },
            update: updateData
        });

        res.json(config);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
