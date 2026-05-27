"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deletePackage = exports.updatePackage = exports.createPackage = exports.getPackages = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const getPackages = async (req, res) => {
    try {
        const packages = await prisma.subscriptionPackage.findMany({
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
        const { name, price, durationInDays, maxDoctors, maxPatients, maxAppointments } = req.body;
        const newPackage = await prisma.subscriptionPackage.create({
            data: {
                name,
                price: parseFloat(price),
                durationInDays: parseInt(durationInDays),
                maxDoctors: parseInt(maxDoctors),
                maxPatients: parseInt(maxPatients),
                maxAppointments: parseInt(maxAppointments),
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
        const { name, price, durationInDays, maxDoctors, maxPatients, maxAppointments, isActive } = req.body;
        const updated = await prisma.subscriptionPackage.update({
            where: { id },
            data: {
                name,
                price: price ? parseFloat(price) : undefined,
                durationInDays: durationInDays ? parseInt(durationInDays) : undefined,
                maxDoctors: maxDoctors ? parseInt(maxDoctors) : undefined,
                maxPatients: maxPatients ? parseInt(maxPatients) : undefined,
                maxAppointments: maxAppointments ? parseInt(maxAppointments) : undefined,
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
        await prisma.subscriptionPackage.delete({ where: { id } });
        return res.json({ message: "Package deleted successfully" });
    }
    catch (error) {
        return res.status(500).json({ message: "Error deleting package" });
    }
};
exports.deletePackage = deletePackage;
