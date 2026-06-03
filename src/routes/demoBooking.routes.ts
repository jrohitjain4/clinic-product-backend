import { Router } from "express";
import { createDemoBooking, getAllDemoBookings, updateDemoBookingStatus } from "../controllers/demoBooking.controller";

const router = Router();

// Public route to book a demo
router.post("/", createDemoBooking);

// Admin route to view bookings
router.get("/", getAllDemoBookings);

// Admin route to update status
router.patch("/:id/status", updateDemoBookingStatus);


export default router;
