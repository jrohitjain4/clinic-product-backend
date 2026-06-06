"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const landingPage_controller_1 = require("../controllers/landingPage.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Public routes - no auth needed
router.get("/:clinicId", landingPage_controller_1.getClinicLandingPage);
router.get("/u/:username", landingPage_controller_1.getClinicLandingPage); // Same controller can handle both if updated or make separate
// Public booking
router.post("/id/:clinicId/book", landingPage_controller_1.bookPublicAppointment);
// Protected route - clinic owner saves their landing page settings
router.put("/:clinicId", auth_middleware_1.authenticateJWT, landingPage_controller_1.upsertLandingPage);
exports.default = router;
