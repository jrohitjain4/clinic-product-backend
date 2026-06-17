"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = __importDefault(require("./lib/prisma"));
async function main() {
    console.log("Checking user by phone...");
    const users = await prisma_1.default.user.findMany({
        where: {
            phone: "9856985696"
        }
    });
    console.log("Users:", JSON.stringify(users, null, 2));
}
main()
    .catch(console.error)
    .finally(() => prisma_1.default.$disconnect());
