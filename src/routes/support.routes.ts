import { Router } from 'express';
import { createTicket, getTickets, updateTicketStatus } from '../controllers/support.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.post('/tickets', authenticateJWT, createTicket);
router.get('/tickets', authenticateJWT, getTickets);
router.put('/tickets/:id/status', authenticateJWT, updateTicketStatus);

export default router;
