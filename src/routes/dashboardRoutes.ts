import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboardController';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.get('/stats', authenticateJWT, getDashboardStats);

export default router;
