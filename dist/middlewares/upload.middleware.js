"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.landingImageUpload = exports.patientProfileUpload = exports.staffProfileUpload = exports.doctorProfileUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const createImageStorage = (folder, prefix) => {
    const dir = path_1.default.join(process.cwd(), "uploads", folder);
    fs_1.default.mkdirSync(dir, { recursive: true });
    return multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, dir),
        filename: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname).toLowerCase() || ".jpg";
            const safeExt = [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)
                ? ext
                : ".jpg";
            cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
        },
    });
};
const doctorStorage = createImageStorage("doctors", "doctor");
const staffStorage = createImageStorage("staffs", "staff");
const patientStorage = createImageStorage("patients", "patient");
const landingStorage = createImageStorage("landing", "landing");
const fileFilter = (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
        cb(null, true);
    }
    else {
        cb(new Error("Only image files are allowed"));
    }
};
exports.doctorProfileUpload = (0, multer_1.default)({
    storage: doctorStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});
exports.staffProfileUpload = (0, multer_1.default)({
    storage: staffStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});
exports.patientProfileUpload = (0, multer_1.default)({
    storage: patientStorage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 },
});
exports.landingImageUpload = (0, multer_1.default)({
    storage: landingStorage,
    fileFilter,
    limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB — user crops before final upload
});
