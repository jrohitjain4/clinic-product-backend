"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const clinicRole_controller_1 = require("../controllers/clinicRole.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateJWT); // Protect all roles routes
router.get("/", clinicRole_controller_1.getClinicRoles);
router.get("/:id", clinicRole_controller_1.getClinicRoleById);
router.post("/", clinicRole_controller_1.createClinicRole);
router.put("/:id", clinicRole_controller_1.updateClinicRole);
router.delete("/:id", clinicRole_controller_1.deleteClinicRole);
exports.default = router;
