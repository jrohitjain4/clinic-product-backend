import { Router } from 'express';
import { getSuperAdminAnalytics } from '../controllers/superadmin/analyticsController';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.get('/analytics', authenticateJWT, getSuperAdminAnalytics);

export default router;
