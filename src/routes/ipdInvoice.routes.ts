import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getIPDInvoices,
  createIPDInvoice,
  addIPDInvoicePayment,
  triggerDailyWardCharges,
} from "../controllers/ipdInvoice.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getIPDInvoices);
router.post("/", createIPDInvoice);
router.post("/trigger-daily-ward-charges", triggerDailyWardCharges);
router.put("/:id/pay", addIPDInvoicePayment);

export default router;
