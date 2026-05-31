"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
// Singleton Prisma Client — prevents multiple DB connection pools
// This is the ONE AND ONLY place PrismaClient is instantiated in this project.
const prisma = new client_1.PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});
exports.default = prisma;
