import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Get a setting by key
export const getSetting = async (req: Request, res: Response) => {
    try {
        const { key } = req.params;
        const setting = await prisma.systemSetting.findUnique({
            where: { key },
        });

        if (!setting) {
            return res.status(404).json({ message: "Setting not found" });
        }

        res.json(setting);
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to fetch setting" });
    }
};

// Create or update a setting
export const upsertSetting = async (req: Request, res: Response) => {
    try {
        const { key, value } = req.body;

        if (!key || value === undefined) {
            return res.status(400).json({ message: "Key and value are required" });
        }

        const setting = await prisma.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });

        res.json({ message: "Setting saved successfully", setting });
    } catch (error: any) {
        res.status(500).json({ message: error.message || "Failed to save setting" });
    }
};
