"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analyticsController_1 = require("../controllers/superadmin/analyticsController");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get('/analytics', auth_middleware_1.authenticateJWT, analyticsController_1.getSuperAdminAnalytics);
exports.default = router;
