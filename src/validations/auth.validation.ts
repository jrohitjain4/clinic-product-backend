import { z } from "zod";

export const authValidation = {
    // OLD register schema (keep for backward compat)
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

    // NEW multi-step registration draft schema
    registerDraft: z.object({
        body: z.object({
            ownerName: z.string().min(2, "Owner name is required"),
            email: z.string().email("Invalid email format"),
            phone: z.string().min(10, "Valid mobile number is required"),
            whatsappNumber: z.string().optional(),
            password: z.string().min(6, "Password must be at least 6 characters"),
            clinicName: z.string().min(2, "Clinic name is required"),
            username: z.string().min(3, "Username must be at least 3 characters"),
            addressLine1: z.string().min(3, "Address is required"),
            addressLine2: z.string().optional(),
            district: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            country: z.string().optional(),
            pincode: z.string().optional(),
            doctorCount: z.number().optional().or(z.string().optional()),
        }),
    }),

    // Flexible login - accepts email, mobile, or username
    login: z.object({
        body: z.object({
            identifier: z.string().min(1, "Email, mobile or username is required").optional(),
            email: z.string().optional(),
            password: z.string().min(1, "Password is required"),
        }),
    }),
};
