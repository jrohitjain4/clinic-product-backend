"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteService = exports.updateService = exports.createService = exports.getServices = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
// GET /api/services
const getServices = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const services = await prisma_1.default.service.findMany({
            where: { clinicId },
            include: {
                department: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });
        res.json(services);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.getServices = getServices;
// POST /api/services
const createService = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated" });
        const { serviceName, departmentId, price, status } = req.body;
        if (!serviceName || !departmentId || price === undefined) {
            return res.status(400).json({ message: "Service Name, Department, and Price are required" });
        }
        const newService = await prisma_1.default.service.create({
            data: {
                serviceName,
                departmentId,
                price: parseFloat(price),
                status: status || "Active",
                clinicId,
            },
            include: {
                department: true,
            }
        });
        res.status(201).json(newService);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.createService = createService;
// PUT /api/services/:id
const updateService = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const { serviceName, departmentId, price, status } = req.body;
        const existing = await prisma_1.default.service.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Service not found" });
        const updated = await prisma_1.default.service.update({
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
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.updateService = updateService;
// DELETE /api/services/:id
const deleteService = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        const { id } = req.params;
        const existing = await prisma_1.default.service.findFirst({ where: { id, clinicId: clinicId } });
        if (!existing)
            return res.status(404).json({ message: "Service not found" });
        await prisma_1.default.service.delete({ where: { id } });
        res.json({ message: "Service deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
};
exports.deleteService = deleteService;
