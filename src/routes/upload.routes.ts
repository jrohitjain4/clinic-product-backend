import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  doctorProfileUpload,
  patientProfileUpload,
  staffProfileUpload,
  landingImageUpload,
} from "../middlewares/upload.middleware";
import {
  uploadDoctorProfile,
  uploadPatientProfile,
  uploadStaffProfile,
  uploadLandingImage,
} from "../controllers/upload.controller";

const router = Router();

router.use(authenticateJWT);

router.post("/doctor-profile", (req, res) => {
  doctorProfileUpload.single("profileImage")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
    return uploadDoctorProfile(req, res);
  });
});

router.post("/staff-profile", (req, res) => {
  staffProfileUpload.single("profileImage")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
    return uploadStaffProfile(req, res);
  });
});

router.post("/patient-profile", (req, res) => {
  patientProfileUpload.single("profileImage")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
    return uploadPatientProfile(req, res);
  });
});

router.post("/landing-image", (req, res) => {
  landingImageUpload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
    return uploadLandingImage(req, res);
  });
});

export default router;
