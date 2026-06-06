import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const getTodos = async (req: Request, res: Response) => {
    try {
        const { clinicId } = (req as any).user;
        const todos = await prisma.todo.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });
        res.json(todos);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const createTodo = async (req: Request, res: Response) => {
    try {
        const { clinicId, id: userId } = (req as any).user;
        const { title, priority, taskDate } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Task description is required" });
        }

        const todo = await prisma.todo.create({
            data: {
                title,
                priority: priority || "Medium",
                taskDate: taskDate ? new Date(taskDate) : null,
                clinicId,
                userId,
            },
        });
        res.status(201).json(todo);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const updateTodo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, priority, status, taskDate } = req.body;

        const todo = await prisma.todo.update({
            where: { id },
            data: {
                title,
                priority,
                status,
                taskDate: taskDate ? new Date(taskDate) : undefined
            },
        });
        res.json(todo);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const deleteTodo = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.todo.delete({ where: { id } });
        res.json({ message: "Todo deleted successfully" });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};

export const bulkDeleteTodos = async (req: Request, res: Response) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Invalid or empty IDs" });
        }
        await prisma.todo.deleteMany({
            where: {
                id: { in: ids }
            }
        });
        res.json({ message: `${ids.length} tasks deleted successfully` });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
};
