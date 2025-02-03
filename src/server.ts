import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import apiRouter from './routes/api.router';
import morgan from 'morgan';
import { globalErrorHandler } from './middlewares/error.middleware';
import { protectedRoute } from './middlewares/protected.middleware';
import cron from 'node-cron';
import { updateOrders } from './services/orders.service';

const app = express();

// Daily update of the orders
async function dailyAction() {
  console.log('Running daily action at', new Date().toISOString());
  await updateOrders();
}

// Schedule the dailyAction to run every day at midnight (00:00)
cron.schedule('0 0 * * *', () => {
  dailyAction();
});

app.use(helmet());
app.use(cors());

app.use(morgan('tiny'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Public route that returns allowed routes
app.get('/', (req, res) => {
  res.json({
    allowedRoutes: ['/api/ordersCSV', '/api/order/:orderID'],
  });
});

app.use('/api', protectedRoute, apiRouter);

app.use(globalErrorHandler);

export default app;
