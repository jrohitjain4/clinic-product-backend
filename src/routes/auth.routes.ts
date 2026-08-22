import { Router } from "express";
import rateLimit from "express-rate-limit";
import { register, login, getMe, getClinics, getPackages, checkUsername, registerDraft, registerFull, completeRegistration, upgradePlan, requestPasswordReset, resetPassword, updateProfile, changePassword, updateOnboardingStep, sendLoginOTP, verifyOTPLogin } from "../controllers/auth.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import { authValidation } from "../validations/auth.validation";

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login/register attempts, please try again after a few minutes." },
});

const router = Router();

router.get("/clinics", getClinics);
router.get("/packages", getPackages);
router.get("/check-username", checkUsername);
router.post("/register", authRateLimiter, validate(authValidation.register), register);
router.post("/register-draft", authRateLimiter, validate(authValidation.registerDraft), registerDraft);
router.post("/register-full", authRateLimiter, registerFull);
router.post("/complete-registration", authRateLimiter, completeRegistration);
router.post("/login", authRateLimiter, validate(authValidation.login), login);
router.post("/send-otp", authRateLimiter, sendLoginOTP);
router.post("/verify-otp-login", authRateLimiter, verifyOTPLogin);
router.post("/request-password-reset", authRateLimiter, requestPasswordReset);
router.post("/reset-password", authRateLimiter, resetPassword);
router.get("/me", authenticateJWT, getMe);
router.put("/profile", authenticateJWT, updateProfile);
router.put("/onboarding-step", authenticateJWT, updateOnboardingStep);
router.put("/change-password", authenticateJWT, changePassword);
router.post("/upgrade-plan", authenticateJWT, upgradePlan);

export default router;
