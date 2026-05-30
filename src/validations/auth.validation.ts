import { z } from "zod";

export const authValidation = {
    register: z.object({
        body: z.object({
            email: z.string().email("Invalid email format"),
            password: z.string().min(8, "Password must be at least 8 characters long"),
            fullName: z.string().min(2, "Full name is required"),
            role: z.enum(["SUPER_ADMIN", "ADMIN", "DOCTOR", "PATIENT", "STAFF"]),
            clinicName: z.string().optional(),
            gstNo: z.string().optional(),
            address: z.string().optional(),
            packageId: z.string().uuid().optional().or(z.literal("")),
            specialization: z.string().optional(),
            experience: z.number().nonnegative().optional(),
        }),
    }),

    login: z.object({
        body: z.object({
            email: z.string().email("Invalid email format"),
            password: z.string().min(1, "Password is required"),
        }),
    }),
};
