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
        const { title, priority } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Title is required" });
        }

        const todo = await prisma.todo.create({
            data: {
                title,
                priority: priority || "Medium",
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
        const { title, priority, status } = req.body;

        const todo = await prisma.todo.update({
            where: { id },
            data: { title, priority, status },
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
