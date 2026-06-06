"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authValidation = void 0;
const zod_1 = require("zod");
exports.authValidation = {
    // OLD register schema (keep for backward compat)
    register: zod_1.z.object({
        body: zod_1.z.object({
            email: zod_1.z.string().email("Invalid email format"),
            password: zod_1.z.string().min(8, "Password must be at least 8 characters long"),
            fullName: zod_1.z.string().min(2, "Full name is required"),
            role: zod_1.z.enum(["SUPER_ADMIN", "ADMIN", "DOCTOR", "PATIENT", "STAFF"]),
            clinicName: zod_1.z.string().optional(),
            gstNo: zod_1.z.string().optional(),
            address: zod_1.z.string().optional(),
            packageId: zod_1.z.string().uuid().optional().or(zod_1.z.literal("")),
            specialization: zod_1.z.string().optional(),
            experience: zod_1.z.number().nonnegative().optional(),
        }),
    }),
    // NEW multi-step registration draft schema (Now just for uniqueness validation)
    registerDraft: zod_1.z.object({
        body: zod_1.z.object({
            email: zod_1.z.string().email("Invalid email format"),
            phone: zod_1.z.string().min(10, "Valid mobile number is required"),
            username: zod_1.z.string().min(3, "Username must be at least 3 characters"),
        }),
    }),
    // Flexible login - accepts email, mobile, or username
    login: zod_1.z.object({
        body: zod_1.z.object({
            identifier: zod_1.z.string().min(1, "Email, mobile or username is required"),
            password: zod_1.z.string().min(1, "Password is required"),
        }),
    }),
};
