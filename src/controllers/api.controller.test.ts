import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import request from 'supertest';

// Mock the protected middleware so that it always calls next().
vi.mock('../middlewares/protected.middleware', () => ({
  protectedRoute: (req: Request, res: Response, next: NextFunction) => {
    next();
  },
}));

// Mock prisma db
vi.mock('../db', () => ({
  default: {
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

import prisma from '../db';
import app from '../server';

describe('API Routes without API key', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/ordersCSV', () => {
    it('should return CSV data for valid orders', async () => {
      // Arrange: Mock prisma.order.findMany to return sample orders.
      (prisma.order.findMany as any).mockResolvedValue([
        {
          orderID: 'order1',
          orderWorth: 100,
          products: [{ productID: 'p1', quantity: 2 }],
        },
      ]);

      const response = await request(app).get(
        '/api/ordersCSV?minWorth=50&maxWorth=150',
      );

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toMatch(/text\/csv/);
      expect(response.text).toContain('order1');
      expect(response.text).toContain('100');
      expect(response.text).toContain('p1');
    });

    it('should return an error when no orders match criteria', async () => {
      // Return an empty array to simulate no orders being found.
      (prisma.order.findMany as any).mockResolvedValue([]);

      const response = await request(app).get('/api/ordersCSV?minWorth=500');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain(
        'There are no matching orders based on the provided criteria.',
      );
    });

    it('should return a 400 error when minWorth is not a valid number', async () => {
      const response = await request(app).get(
        '/api/ordersCSV?minWorth=invalid&maxWorth=150',
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Validation Error');
    });

    it('should return CSV data when only minWorth is provided', async () => {
      // Testing with only minWorth provided.
      (prisma.order.findMany as any).mockResolvedValue([
        {
          orderID: 'order2',
          orderWorth: 120,
          products: [{ productID: 'p2', quantity: 1 }],
        },
      ]);

      const response = await request(app).get('/api/ordersCSV?minWorth=100');

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toMatch(/text\/csv/);
      expect(response.text).toContain('order2');
    });

    it('should return CSV data when only maxWorth is provided', async () => {
      // Testing with only maxWorth provided.
      (prisma.order.findMany as any).mockResolvedValue([
        {
          orderID: 'order3',
          orderWorth: 80,
          products: [{ productID: 'p3', quantity: 5 }],
        },
      ]);

      const response = await request(app).get('/api/ordersCSV?maxWorth=100');

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toMatch(/text\/csv/);
      expect(response.text).toContain('order3');
    });

    it('should return a 400 error when minWorth is greater than maxWorth', async () => {
      const response = await request(app).get(
        '/api/ordersCSV?minWorth=200&maxWorth=100',
      );

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Validation Error');
    });

    it('should handle unexpected errors from the database gracefully', async () => {
      // Simulate a database error.
      (prisma.order.findMany as any).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get(
        '/api/ordersCSV?minWorth=50&maxWorth=150',
      );

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Internal Server Error');
    });
  });

  describe('GET /api/order/:orderID', () => {
    it('should return order details when the order exists', async () => {
      (prisma.order.findUnique as any).mockResolvedValue({
        orderID: 'order1',
        orderWorth: 150,
        products: [{ productID: 'p1', quantity: 3 }],
      });

      const response = await request(app).get('/api/order/order1');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        orderID: 'order1',
        orderWorth: 150,
        products: [{ productID: 'p1', quantity: 3 }],
      });
    });

    it('should return an error when the order does not exist', async () => {
      // Return null to simulate no order found.
      (prisma.order.findUnique as any).mockResolvedValue(null);

      const response = await request(app).get('/api/order/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.message).toContain(
        'The order with the given ID was not found.',
      );
    });

    it('should handle unexpected errors when accessing a specific order', async () => {
      // Simulate a database error.
      (prisma.order.findUnique as any).mockRejectedValue(new Error('DB error'));

      const response = await request(app).get('/api/order/order1');

      expect(response.status).toBe(500);
      expect(response.body.message).toContain('Internal Server Error');
    });
  });
});
