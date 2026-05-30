import { PrismaClient } from "@prisma/client";

// Singleton Prisma Client — prevents multiple DB connection pools
// This is the ONE AND ONLY place PrismaClient is instantiated in this project.
const prisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

export default prisma;
