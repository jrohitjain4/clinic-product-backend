"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePackage = exports.updatePackage = exports.createPackage = exports.getPackages = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getPackages = async (req, res) => {
    try {
        const packages = await prisma_1.default.subscriptionPackage.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return res.json(packages);
    }
    catch (error) {
        return res.status(500).json({ message: "Error fetching packages" });
    }
};
exports.getPackages = getPackages;
const createPackage = async (req, res) => {
    try {
        const { name, price, durationInDays } = req.body;
        const newPackage = await prisma_1.default.subscriptionPackage.create({
            data: {
                name,
                price: parseFloat(price),
                durationInDays: parseInt(durationInDays),
                isActive: true
            }
        });
        return res.status(201).json(newPackage);
    }
    catch (error) {
        console.error("Create package error:", error);
        return res.status(500).json({ message: "Error creating package" });
    }
};
exports.createPackage = createPackage;
const updatePackage = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, durationInDays, isActive } = req.body;
        const updated = await prisma_1.default.subscriptionPackage.update({
            where: { id },
            data: {
                name,
                price: price ? parseFloat(price) : undefined,
                durationInDays: durationInDays ? parseInt(durationInDays) : undefined,
                isActive
            }
        });
        return res.json(updated);
    }
    catch (error) {
        return res.status(500).json({ message: "Error updating package" });
    }
};
exports.updatePackage = updatePackage;
const deletePackage = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.subscriptionPackage.delete({ where: { id } });
        return res.json({ message: "Package deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ message: "Error deleting package" });
    }
};
exports.deletePackage = deletePackage;
