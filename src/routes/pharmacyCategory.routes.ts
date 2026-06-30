import { Router } from "express";
import { getPharmacyCategories, createPharmacyCategory, updatePharmacyCategory, deletePharmacyCategory, bulkDeletePharmacyCategories } from "../controllers/pharmacyCategory.controller";
import { authenticateJWT } from "../middlewares/auth.middleware";

const router = Router();

router.use(authenticateJWT);

router.get("/", getPharmacyCategories);
router.post("/", createPharmacyCategory);
router.post("/bulk-delete", bulkDeletePharmacyCategories);
router.put("/:id", updatePharmacyCategory);
router.delete("/:id", deletePharmacyCategory);

export default router;
