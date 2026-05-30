import { Router } from "express";
import prisma from "../lib/prisma";

const router = Router();

router.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      ok: true,
      database: "connected",
      message: "API and database are healthy",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Database unreachable";
    res.status(503).json({
      ok: false,
      database: "disconnected",
      message:
        "Cannot reach PostgreSQL. If using Render: open dashboard and resume the database, or use local Docker (see backend/docker-compose.yml).",
      detail: message.split("\n")[0],
    });
  }
});

export default router;
