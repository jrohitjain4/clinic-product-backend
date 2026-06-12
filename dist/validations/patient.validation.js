"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientValidation = void 0;
const zod_1 = require("zod");
exports.patientValidation = {
    create: zod_1.z.object({
        body: zod_1.z.object({
            firstName: zod_1.z.string().min(1, "First name is required"),
            lastName: zod_1.z.string().min(1, "Last name is required"),
            email: zod_1.z.string().email("Invalid email").optional().or(zod_1.z.literal("")),
            password: zod_1.z.string().optional().or(zod_1.z.literal("")),
        }).passthrough(),
    }),
};
