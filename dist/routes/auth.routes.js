"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_controller_1 = require("../controllers/auth.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const validate_middleware_1 = require("../middlewares/validate.middleware");
const auth_validation_1 = require("../validations/auth.validation");
const authRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Too many login/register attempts, please try again after a few minutes." },
});
const router = (0, express_1.Router)();
router.get("/clinics", auth_controller_1.getClinics);
router.get("/packages", auth_controller_1.getPackages);
router.get("/check-username", auth_controller_1.checkUsername);
router.post("/register", authRateLimiter, (0, validate_middleware_1.validate)(auth_validation_1.authValidation.register), auth_controller_1.register);
router.post("/register-draft", authRateLimiter, (0, validate_middleware_1.validate)(auth_validation_1.authValidation.registerDraft), auth_controller_1.registerDraft);
router.post("/register-full", authRateLimiter, auth_controller_1.registerFull);
router.post("/complete-registration", authRateLimiter, auth_controller_1.completeRegistration);
router.post("/login", authRateLimiter, (0, validate_middleware_1.validate)(auth_validation_1.authValidation.login), auth_controller_1.login);
router.post("/send-otp", authRateLimiter, auth_controller_1.sendLoginOTP);
router.post("/verify-otp-login", authRateLimiter, auth_controller_1.verifyOTPLogin);
router.post("/request-password-reset", authRateLimiter, auth_controller_1.requestPasswordReset);
router.post("/reset-password", authRateLimiter, auth_controller_1.resetPassword);
router.get("/me", auth_middleware_1.authenticateJWT, auth_controller_1.getMe);
router.put("/profile", auth_middleware_1.authenticateJWT, auth_controller_1.updateProfile);
router.put("/onboarding-step", auth_middleware_1.authenticateJWT, auth_controller_1.updateOnboardingStep);
router.put("/change-password", auth_middleware_1.authenticateJWT, auth_controller_1.changePassword);
router.post("/upgrade-plan", auth_middleware_1.authenticateJWT, auth_controller_1.upgradePlan);
exports.default = router;
