"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteNotes = exports.deleteNote = exports.updateNote = exports.createNote = exports.getNotes = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getNotes = async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const { appointmentId } = req.query;
        const where = { clinicId };
        if (appointmentId) {
            where.appointmentId = appointmentId;
        }
        const notes = await prisma_1.default.note.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        res.json(notes);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getNotes = getNotes;
const createNote = async (req, res) => {
    try {
        const clinicId = req.user.clinicId;
        const { title, content, priority, noteDate, appointmentId } = req.body;
        if (!title) {
            return res.status(400).json({ message: "Note title is required" });
        }
        const note = await prisma_1.default.note.create({
            data: {
                title,
                content,
                priority: priority || "Medium",
                noteDate: noteDate ? new Date(noteDate) : null,
                clinicId,
                userId: req.user.id,
                appointmentId: appointmentId || null,
            },
        });
        res.status(201).json(note);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.createNote = createNote;
const updateNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, content, priority, noteDate } = req.body;
        const note = await prisma_1.default.note.update({
            where: { id },
            data: {
                title,
                content,
                priority,
                noteDate: noteDate ? new Date(noteDate) : undefined,
            },
        });
        res.json(note);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateNote = updateNote;
const deleteNote = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.note.delete({ where: { id } });
        res.json({ message: "Note deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteNote = deleteNote;
const bulkDeleteNotes = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Invalid or empty IDs" });
        }
        await prisma_1.default.note.deleteMany({
            where: {
                id: { in: ids }
            }
        });
        res.json({ message: `${ids.length} notes deleted successfully` });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.bulkDeleteNotes = bulkDeleteNotes;
