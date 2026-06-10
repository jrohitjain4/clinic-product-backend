import multer from "multer";
import path from "path";
import fs from "fs";

const createImageStorage = (folder: string, prefix: string) => {
  const dir = path.join(process.cwd(), "uploads", folder);
  fs.mkdirSync(dir, { recursive: true });
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, dir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
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

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

export const doctorProfileUpload = multer({
  storage: doctorStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const staffProfileUpload = multer({
  storage: staffStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const patientProfileUpload = multer({
  storage: patientStorage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const landingImageUpload = multer({
  storage: landingStorage,
  fileFilter,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB — user crops before final upload
});
