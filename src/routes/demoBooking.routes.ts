import { Router } from "express";
import { createDemoBooking, getAllDemoBookings, updateDemoBookingStatus, deleteDemoBooking, bulkDeleteDemoBookings } from "../controllers/demoBooking.controller";

const router = Router();

// Public route to book a demo
router.post("/", createDemoBooking);

// Admin route to view bookings
router.get("/", getAllDemoBookings);

// Admin route to update status
router.patch("/:id/status", updateDemoBookingStatus);

// Admin route to delete
router.delete("/:id", deleteDemoBooking);

// Admin route to bulk delete
router.post("/bulk-delete", bulkDeleteDemoBookings);

export default router;
