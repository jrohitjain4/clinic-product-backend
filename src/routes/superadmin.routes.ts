import { Router } from 'express';
import { getSuperAdminAnalytics } from '../controllers/superadmin/analyticsController';
import { getRazorpayConfig, upsertRazorpayConfig, deleteRazorpayConfig, activateRazorpayConfig } from '../controllers/superadmin/razorpay.controller';
import { authenticateJWT } from '../middlewares/auth.middleware';

const router = Router();

router.get('/analytics', authenticateJWT, getSuperAdminAnalytics);

router.get('/razorpay-config', authenticateJWT, getRazorpayConfig);
router.post('/razorpay-config', authenticateJWT, upsertRazorpayConfig);
router.delete('/razorpay-config/:id', authenticateJWT, deleteRazorpayConfig);
router.put('/razorpay-config/:id/activate', authenticateJWT, activateRazorpayConfig);

export default router;
