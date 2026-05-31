import { Router } from 'express';
import { createInvoice, getInvoices, getInvoiceById, deleteInvoice, updateInvoice } from '../controllers/invoice.controller';
import { authenticateJWT as authenticateQuery } from '../middlewares/auth.middleware';

const router = Router();

router.post('/', authenticateQuery, createInvoice);
router.get('/', authenticateQuery, getInvoices);
router.get('/:id', authenticateQuery, getInvoiceById);
router.put('/:id', authenticateQuery, updateInvoice);
router.delete('/:id', authenticateQuery, deleteInvoice);

export default router;
