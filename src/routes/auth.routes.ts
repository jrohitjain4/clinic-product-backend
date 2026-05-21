import { Router } from "express";
import { register, login, getMe, getClinics } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.get("/clinics", getClinics);
router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticateJWT, getMe);

export default router;
