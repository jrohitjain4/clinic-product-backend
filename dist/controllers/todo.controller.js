"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bulkDeleteTodos = exports.deleteTodo = exports.updateTodo = exports.createTodo = exports.getTodos = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const getTodos = async (req, res) => {
    try {
        const { clinicId } = req.user;
        const todos = await prisma_1.default.todo.findMany({
            where: { clinicId },
            orderBy: { createdAt: "desc" },
        });
        res.json(todos);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getTodos = getTodos;
const createTodo = async (req, res) => {
    try {
        const { clinicId, id: userId } = req.user;
        const { title, priority, taskDate } = req.body;
        if (!title) {
            return res.status(400).json({ message: "Task description is required" });
        }
        const todo = await prisma_1.default.todo.create({
            data: {
                title,
                priority: priority || "Medium",
                taskDate: taskDate ? new Date(taskDate) : null,
                clinicId,
                userId,
            },
        });
        res.status(201).json(todo);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.createTodo = createTodo;
const updateTodo = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, priority, status, taskDate } = req.body;
        const todo = await prisma_1.default.todo.update({
            where: { id },
            data: {
                title,
                priority,
                status,
                taskDate: taskDate ? new Date(taskDate) : undefined
            },
        });
        res.json(todo);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateTodo = updateTodo;
const deleteTodo = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma_1.default.todo.delete({ where: { id } });
        res.json({ message: "Todo deleted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.deleteTodo = deleteTodo;
const bulkDeleteTodos = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: "Invalid or empty IDs" });
        }
        await prisma_1.default.todo.deleteMany({
            where: {
                id: { in: ids }
            }
        });
        res.json({ message: `${ids.length} tasks deleted successfully` });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.bulkDeleteTodos = bulkDeleteTodos;
