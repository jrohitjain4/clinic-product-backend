import { Request, Response } from "express";
import prisma from "../lib/prisma";

export const createDemoBooking = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, phone, location, clinicName, dateTime } = req.body;

        if (!email || !phone) {
            res.status(400).json({ message: "Email and phone are required" });
            return;
        }

        const booking = await prisma.demoBooking.create({
            data: {
                name,
                email,
                phone,
                location,
                clinicName,
                dateTime: dateTime ? new Date(dateTime) : null,
            },
        });

        res.status(201).json({ message: "Demo booked successfully", data: booking });
    } catch (error: any) {
        console.error("Error creating demo booking:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

export const getAllDemoBookings = async (req: Request, res: Response): Promise<void> => {
    try {
        const bookings = await prisma.demoBooking.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json(bookings);
    } catch (error: any) {
        console.error("Error fetching demo bookings:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
export const updateDemoBookingStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            res.status(400).json({ message: "Status is required" });
            return;
        }

        const booking = await prisma.demoBooking.update({
            where: { id },
            data: { status },
        });

        res.status(200).json({ message: "Status updated successfully", data: booking });
    } catch (error: any) {
        console.error("Error updating demo booking status:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
