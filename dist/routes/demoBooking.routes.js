"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const demoBooking_controller_1 = require("../controllers/demoBooking.controller");
const router = (0, express_1.Router)();
// Public route to book a demo
router.post("/", demoBooking_controller_1.createDemoBooking);
// Admin route to view bookings
router.get("/", demoBooking_controller_1.getAllDemoBookings);
// Admin route to update status
router.patch("/:id/status", demoBooking_controller_1.updateDemoBookingStatus);
exports.default = router;
