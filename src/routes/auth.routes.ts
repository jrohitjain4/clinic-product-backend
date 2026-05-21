import { Router } from "express";
import { register, login, getMe, getClinics, getPackages, registerDraft, completeRegistration } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.get("/clinics", getClinics);
router.get("/packages", getPackages);
router.post("/register", register);
router.post("/register-draft", registerDraft);
router.post("/complete-registration", completeRegistration);
router.post("/login", login);
router.get("/me", authenticateJWT, getMe);

export default router;
