"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertSetting = exports.getSetting = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// Get a setting by key
const getSetting = async (req, res) => {
    try {
        const { key } = req.params;
        const setting = await prisma_1.default.systemSetting.findUnique({
            where: { key },
        });
        if (!setting) {
            return res.status(404).json({ message: "Setting not found" });
        }
        res.json(setting);
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Failed to fetch setting" });
    }
};
exports.getSetting = getSetting;
// Create or update a setting
const upsertSetting = async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ message: "Key and value are required" });
        }
        const setting = await prisma_1.default.systemSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value },
        });
        res.json({ message: "Setting saved successfully", setting });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Failed to save setting" });
    }
};
exports.upsertSetting = upsertSetting;
