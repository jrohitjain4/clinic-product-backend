"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const leave_controller_1 = require("../controllers/leave.controller");
const router = express_1.default.Router();
router.use(auth_middleware_1.authenticateJWT);
router.get("/", leave_controller_1.getLeaves);
router.post("/apply", leave_controller_1.applyLeave);
router.put("/:id/status", leave_controller_1.updateLeaveStatus);
router.delete("/:id", leave_controller_1.deleteLeave);
exports.default = router;
