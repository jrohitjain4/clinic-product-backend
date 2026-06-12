import { Router } from "express";
import { createRazorpayOrder, verifyRazorpayPayment } from "../controllers/payment.controller";

const router = Router();

router.post("/create-order", createRazorpayOrder);
router.post("/verify", verifyRazorpayPayment);

export default router;
