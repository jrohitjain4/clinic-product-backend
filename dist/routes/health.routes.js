"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = __importDefault(require("../lib/prisma"));
const router = (0, express_1.Router)();
router.get("/", async (_req, res) => {
    try {
        await prisma_1.default.$queryRaw `SELECT 1`;
        res.json({
            ok: true,
            database: "connected",
            message: "API and database are healthy",
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Database unreachable";
        res.status(503).json({
            ok: false,
            database: "disconnected",
            message: "Cannot reach PostgreSQL. If using Render: open dashboard and resume the database, or use local Docker (see backend/docker-compose.yml).",
            detail: message.split("\n")[0],
        });
    }
});
exports.default = router;
