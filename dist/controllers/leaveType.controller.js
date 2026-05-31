"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteLeaveType = exports.updateLeaveType = exports.getLeaveTypes = exports.createLeaveType = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const createLeaveType = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated with your account" });
        const { name, quota, status } = req.body;
        if (!name || quota === undefined) {
            return res.status(400).json({ message: "Name and Quota are required" });
        }
        const leaveType = await prisma_1.default.leaveType.create({
            data: {
                name,
                quota: parseInt(quota, 10),
                status: status || "Active",
                clinicId,
            },
        });
        res.status(201).json(leaveType);
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Failed to create leave type" });
    }
};
exports.createLeaveType = createLeaveType;
const getLeaveTypes = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated with your account" });
        const leaveTypes = await prisma_1.default.leaveType.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });
        res.json(leaveTypes);
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Failed to fetch leave types" });
    }
};
exports.getLeaveTypes = getLeaveTypes;
const updateLeaveType = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated with your account" });
        const { id } = req.params;
        const { name, quota, status } = req.body;
        const dataToUpdate = {};
        if (name)
            dataToUpdate.name = name;
        if (quota !== undefined)
            dataToUpdate.quota = parseInt(quota, 10);
        if (status)
            dataToUpdate.status = status;
        const leaveType = await prisma_1.default.leaveType.updateMany({
            where: { id, clinicId },
            data: dataToUpdate,
        });
        res.json({ message: "Leave type updated successfully", updated: leaveType.count > 0 });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Failed to update leave type" });
    }
};
exports.updateLeaveType = updateLeaveType;
const deleteLeaveType = async (req, res) => {
    try {
        const clinicId = req.user?.clinicId;
        if (!clinicId)
            return res.status(403).json({ message: "No clinic associated with your account" });
        const { id } = req.params;
        const leaveType = await prisma_1.default.leaveType.deleteMany({
            where: { id, clinicId },
        });
        res.json({ message: "Leave type deleted successfully", deleted: leaveType.count > 0 });
    }
    catch (error) {
        res.status(500).json({ message: error.message || "Failed to delete leave type" });
    }
};
exports.deleteLeaveType = deleteLeaveType;
