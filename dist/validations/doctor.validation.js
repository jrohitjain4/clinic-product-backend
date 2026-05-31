"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.doctorValidation = void 0;
const zod_1 = require("zod");
exports.doctorValidation = {
    create: zod_1.z.object({
        body: zod_1.z.object({
            fullName: zod_1.z.string().min(1, "Full name is required"),
            email: zod_1.z.string().email("Invalid email"),
            password: zod_1.z.string().optional().or(zod_1.z.literal("")),
        }).passthrough(),
    }),
};
