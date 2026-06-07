import { Router } from 'express';
import { authenticateToken } from '../../middleware/auth.js';
import { TelemetryCockpitController } from '../../controllers/startup/TelemetryCockpitController.js';

const router = Router();
const controller = new TelemetryCockpitController();

// Aplica autenticação a todos os endpoints do cockpit
router.use(authenticateToken);

router.get('/summary', (req, res) => controller.getSummary(req, res));
router.get('/por-feature', (req, res) => controller.getCostByFeature(req, res));
router.get('/cobertura', (req, res) => controller.getCobertura(req, res));
router.get('/eventos', (req, res) => controller.getEventos(req, res));
router.get('/exportar-csv', (req, res) => controller.exportCsv(req, res));

export default router;
