import { Router } from "express";
import { register, login, getMe, getClinics, getPackages, registerDraft, registerFull, completeRegistration, upgradePlan, requestPasswordReset, resetPassword, updateProfile, changePassword } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { authValidation } from "../validations/auth.validation";

const router = Router();

router.get("/clinics", getClinics);
router.get("/packages", getPackages);
router.post("/register", validate(authValidation.register), register);
router.post("/register-draft", validate(authValidation.registerDraft), registerDraft);
router.post("/register-full", registerFull);
router.post("/complete-registration", completeRegistration);
router.post("/login", validate(authValidation.login), login);
router.post("/request-password-reset", requestPasswordReset);
router.post("/reset-password", resetPassword);
router.get("/me", authenticateJWT, getMe);
router.put("/profile", authenticateJWT, updateProfile);
router.put("/change-password", authenticateJWT, changePassword);
router.post("/upgrade-plan", authenticateJWT, upgradePlan);

export default router;
