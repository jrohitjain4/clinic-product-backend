import { Router } from "express";
import { register, login, getMe, getClinics, getPackages, registerDraft, completeRegistration, upgradePlan } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { authValidation } from "../validations/auth.validation";

const router = Router();

router.get("/clinics", getClinics);
router.get("/packages", getPackages);
router.post("/register", validate(authValidation.register), register);
router.post("/register-draft", validate(authValidation.register), registerDraft);
router.post("/complete-registration", completeRegistration);
router.post("/login", validate(authValidation.login), login);
router.get("/me", authenticateJWT, getMe);
router.post("/upgrade-plan", authenticateJWT, upgradePlan);

export default router;
