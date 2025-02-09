import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import apiRouter from './routes/api.router';
import morgan from 'morgan';
import { globalErrorHandler } from './middlewares/error.middleware';
import { protectedRoute } from './middlewares/protected.middleware';
import cron from 'node-cron';
import { updateOrders } from './services/orders.service';
import { delay } from './utils';

const app = express();

// Daily update of the orders
async function dailyAction() {
  console.log('Running daily update at', new Date().toISOString());
  const maxRetries = 4;
  const timeouts = [60000, 600000, 3600000]; // 1 minute, 10 minutes, 1 hour in milliseconds
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      await updateOrders();
      console.log('Daily update completed successfully.');
      return; // Exit the function if successful
    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt} failed`);
      globalErrorHandler(error);

      if (attempt < maxRetries) {
        // Get the timeout for the current attempt
        const timeout = timeouts[attempt - 1];
        console.log(`Retrying in ${timeout / 1000} seconds...`);
        await delay(timeout);
      } else {
        console.log('Daily update failed after multiple retry attempts.');
      }
    }
  }
}

// Schedule the dailyAction to run every day at midnight (00:00)
cron.schedule('0 0 * * *', () => {
  dailyAction();
});

// Update orders on start-up
(async () => {
  await dailyAction();
})();

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
