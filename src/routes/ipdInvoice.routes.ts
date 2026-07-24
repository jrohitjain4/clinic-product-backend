import { Router } from "express";
import { authenticateJWT } from "../middlewares/auth.middleware";
import {
  getIPDInvoices,
  createIPDInvoice,
  addIPDInvoicePayment,
} from "../controllers/ipdInvoice.controller";

const router = Router();

router.use(authenticateJWT);

router.get("/", getIPDInvoices);
router.post("/", createIPDInvoice);
router.put("/:id/pay", addIPDInvoicePayment);

export default router;
