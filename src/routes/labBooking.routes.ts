import { Router } from "express";
import { getLabBookings, createLabBooking, updateLabBooking, deleteLabBooking, bulkDeleteLabBookings, getLabDashboard } from "../controllers/labBooking.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/dashboard", getLabDashboard);
router.get("/", getLabBookings);
router.post("/", createLabBooking);
router.post("/bulk-delete", bulkDeleteLabBookings);
router.put("/:id", updateLabBooking);
router.delete("/:id", deleteLabBooking);

export default router;
