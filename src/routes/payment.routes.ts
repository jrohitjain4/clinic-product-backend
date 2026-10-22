import { Router } from "express";
import {
    createRazorpayOrder,
    createRazorpaySubscription,
    verifyRazorpayPayment,
    handleRazorpayWebhook,
    cancelAutoPay
} from "../controllers/payment.controller";

const router = Router();

router.post("/create-order", createRazorpayOrder);
router.post("/create-subscription", createRazorpaySubscription);
router.post("/verify", verifyRazorpayPayment);
router.post("/webhook", handleRazorpayWebhook);
router.post("/cancel-autopay", cancelAutoPay);

export default router;

