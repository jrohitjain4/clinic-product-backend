import express from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import { getProducts, createProduct, updateProduct, deleteProduct } from "../controllers/product.controller";

const router = express.Router();

router.use(authenticateJWT);

router.get("/", getProducts);
router.post("/", createProduct);
router.put("/:id", updateProduct);
router.delete("/:id", deleteProduct);

export default router;
