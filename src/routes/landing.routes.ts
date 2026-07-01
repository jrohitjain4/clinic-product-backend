import { Router } from "express";
import { getClinicLandingPage, upsertLandingPage, bookPublicAppointment, bookPublicDiagnostic } from "../controllers/landingPage.controller";
import { authenticateJWT as authenticate } from "../middlewares/auth.middleware";

const router = Router();

// Public routes - no auth needed
router.get("/:clinicId", getClinicLandingPage);
router.get("/u/:username", getClinicLandingPage); // Same controller can handle both if updated or make separate

// Public booking
router.post("/id/:clinicId/book", bookPublicAppointment);
router.post("/id/:clinicId/book-diagnostic", bookPublicDiagnostic);

// Protected route - clinic owner saves their landing page settings
router.put("/:clinicId", authenticate, upsertLandingPage);

export default router;
