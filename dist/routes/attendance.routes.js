"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_middleware_1 = require("../middlewares/auth.middleware");
const attendance_controller_1 = require("../controllers/attendance.controller");
const router = express_1.default.Router();
router.use(auth_middleware_1.authenticateJWT);
router.post("/mark-self", attendance_controller_1.markSelfAttendance);
router.post("/mark", attendance_controller_1.markAttendance);
router.get("/today-status", attendance_controller_1.getMyTodayStatus);
router.get("/", attendance_controller_1.getAttendance);
exports.default = router;
