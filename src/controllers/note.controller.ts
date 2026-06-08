import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const getNotes = async (req: any, res: Response) => {
    try {
        const clinicId = req.user.clinicId;
        const { appointmentId } = req.query;

        const where: any = { clinicId };
        if (appointmentId) {
            where.appointmentId = appointmentId;
        }

        const notes = await prisma.note.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        res.json(notes);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createNote = async (req: any, res: Response) => {
    try {
        const clinicId = req.user.clinicId;
        const { title, content, priority, noteDate, appointmentId } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Note title is required" });
        }

        const note = await prisma.note.create({
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
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateNote = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, content, priority, noteDate } = req.body;

        const note = await prisma.note.update({
            where: { id },
            data: {
                title,
                content,
                priority,
                noteDate: noteDate ? new Date(noteDate) : undefined,
            },
        });
        res.json(note);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteNote = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.note.delete({ where: { id } });
        res.json({ message: "Note deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const bulkDeleteNotes = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Invalid or empty IDs" });
        }
        await prisma.note.deleteMany({
            where: {
                id: { in: ids }
            }
        });
        res.json({ message: `${ids.length} notes deleted successfully` });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
