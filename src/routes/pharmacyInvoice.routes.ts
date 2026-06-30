import { Router } from "express";
import { getPharmacyInvoices, getPharmacyInvoiceById, createPharmacyInvoice, deletePharmacyInvoice, getPharmacyDashboardStats } from "../controllers/pharmacyInvoice.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/dashboard", getPharmacyDashboardStats);
router.get("/", getPharmacyInvoices);
router.get("/:id", getPharmacyInvoiceById);
router.post("/", createPharmacyInvoice);
router.delete("/:id", deletePharmacyInvoice);

export default router;
