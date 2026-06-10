"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadLandingImage = exports.uploadPatientProfile = exports.uploadStaffProfile = exports.uploadDoctorProfile = void 0;
const uploadDoctorProfile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file uploaded" });
        }
        const url = `/uploads/doctors/${req.file.filename}`;
        res.json({ url, filename: req.file.filename });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        res.status(500).json({ message });
    }
};
exports.uploadDoctorProfile = uploadDoctorProfile;
const uploadStaffProfile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file uploaded" });
        }
        const url = `/uploads/staffs/${req.file.filename}`;
        res.json({ url, filename: req.file.filename });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        res.status(500).json({ message });
    }
};
exports.uploadStaffProfile = uploadStaffProfile;
const uploadPatientProfile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file uploaded" });
        }
        const url = `/uploads/patients/${req.file.filename}`;
        res.json({ url, filename: req.file.filename });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        res.status(500).json({ message });
    }
};
exports.uploadPatientProfile = uploadPatientProfile;
const uploadLandingImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No image file uploaded" });
        }
        const url = `/uploads/landing/${req.file.filename}`;
        res.json({ url, filename: req.file.filename });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        res.status(500).json({ message });
    }
};
exports.uploadLandingImage = uploadLandingImage;
