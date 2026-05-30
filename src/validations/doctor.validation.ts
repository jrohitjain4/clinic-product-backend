import { z } from "zod";

export const doctorValidation = {
    create: z.object({
        body: z.object({
            fullName: z.string().min(1, "Full name is required"),
            email: z.string().email("Invalid email"),
            password: z.string().optional().or(z.literal("")),
        }).passthrough(),
    }),
};
