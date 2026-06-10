import { z } from "zod";

export const patientValidation = {
    create: z.object({
        body: z.object({
            firstName: z.string().min(1, "First name is required"),
            lastName: z.string().min(1, "Last name is required"),
            email: z.string().email("Invalid email").optional().or(z.literal("")),
            password: z.string().optional().or(z.literal("")),
        }).passthrough(),
    }),
};
