"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const search_controller_1 = require("../controllers/search.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateJWT);
router.get("/", search_controller_1.globalSearch);
exports.default = router;
