import { Router } from 'express';
import { getDashboardMetrics, getRecentSales } from '../controllers/metricsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Todas as rotas de métricas requerem autenticação
router.use(authMiddleware);

router.get('/dashboard', getDashboardMetrics);
router.get('/sales/recent', getRecentSales);

export default router;