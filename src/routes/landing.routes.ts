import { Router } from "express";
import { getClinicLandingPage, upsertLandingPage, bookPublicAppointment } from "../controllers/landingPage.controller";
import { authenticateJWT as authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Public route - no auth needed
router.get("/:clinicId", getClinicLandingPage);

// Public booking - no auth needed
router.post("/:clinicId/book", bookPublicAppointment);

// Protected route - clinic owner saves their landing page settings
router.put("/:clinicId", authenticate, upsertLandingPage);

export default router;
