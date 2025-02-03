import { Router } from 'express';
import { getAllOrdersCSV, getOrder } from '../controllers/api.controller';

const router = Router();

router.get('/ordersCSV', getAllOrdersCSV);
router.get('/order/:orderID', getOrder);

export default router;
