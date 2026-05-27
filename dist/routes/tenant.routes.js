"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenant_controller_1 = require("../controllers/tenant.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
router.get("/", auth_middleware_1.authenticateJWT, tenant_controller_1.getTenants);
router.put("/:id/status", auth_middleware_1.authenticateJWT, tenant_controller_1.updateTenantStatus);
exports.default = router;
