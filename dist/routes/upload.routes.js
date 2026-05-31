"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middlewares/auth.middleware");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const upload_controller_1 = require("../controllers/upload.controller");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticateJWT);
router.post("/doctor-profile", (req, res) => {
    upload_middleware_1.doctorProfileUpload.single("profileImage")(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                message: err instanceof Error ? err.message : "Upload failed",
            });
        }
        return (0, upload_controller_1.uploadDoctorProfile)(req, res);
    });
});
router.post("/staff-profile", (req, res) => {
    upload_middleware_1.staffProfileUpload.single("profileImage")(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                message: err instanceof Error ? err.message : "Upload failed",
            });
        }
        return (0, upload_controller_1.uploadStaffProfile)(req, res);
    });
});
router.post("/patient-profile", (req, res) => {
    upload_middleware_1.patientProfileUpload.single("profileImage")(req, res, (err) => {
        if (err) {
            return res.status(400).json({
                message: err instanceof Error ? err.message : "Upload failed",
            });
        }
        return (0, upload_controller_1.uploadPatientProfile)(req, res);
    });
});
exports.default = router;
