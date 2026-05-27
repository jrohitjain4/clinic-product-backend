"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const package_controller_1 = require("../controllers/package.controller");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const router = (0, express_1.Router)();
// Publicly accessible for registration
router.get("/", package_controller_1.getPackages);
// Super Admin protected (Should add role check here, but using authenticateJWT for now)
router.post("/", auth_middleware_1.authenticateJWT, package_controller_1.createPackage);
router.put("/:id", auth_middleware_1.authenticateJWT, package_controller_1.updatePackage);
router.delete("/:id", auth_middleware_1.authenticateJWT, package_controller_1.deletePackage);
exports.default = router;
