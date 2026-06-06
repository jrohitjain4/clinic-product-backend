"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDemoBookingStatus = exports.getAllDemoBookings = exports.createDemoBooking = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const createDemoBooking = async (req, res) => {
    try {
        const { name, email, phone, location, clinicName, dateTime } = req.body;
        if (!email || !phone) {
            res.status(400).json({ message: "Email and phone are required" });
            return;
        }
        const booking = await prisma_1.default.demoBooking.create({
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
    }
    catch (error) {
        console.error("Error creating demo booking:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.createDemoBooking = createDemoBooking;
const getAllDemoBookings = async (req, res) => {
    try {
        const bookings = await prisma_1.default.demoBooking.findMany({
            orderBy: { createdAt: "desc" },
        });
        res.status(200).json(bookings);
    }
    catch (error) {
        console.error("Error fetching demo bookings:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.getAllDemoBookings = getAllDemoBookings;
const updateDemoBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) {
            res.status(400).json({ message: "Status is required" });
            return;
        }
        const booking = await prisma_1.default.demoBooking.update({
            where: { id },
            data: { status },
        });
        res.status(200).json({ message: "Status updated successfully", data: booking });
    }
    catch (error) {
        console.error("Error updating demo booking status:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};
exports.updateDemoBookingStatus = updateDemoBookingStatus;
