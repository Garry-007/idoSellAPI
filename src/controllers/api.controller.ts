import { Request, Response } from 'express';
import { orderIDSchema, orderQuerySchema } from '../validation';
import prisma from '../db';
import { OrderNotFoundError, OrdersNotFoundError } from '../errors';
import { json2csv } from 'json-2-csv';

interface ApiOrderResponse {
  orderID: string;
  products: {
    productID: number;
    quantity: number;
  }[];
  orderWorth: number;
}

export const getAllOrdersCSV = async (req: Request, res: Response) => {
  const validatedQuery = orderQuerySchema.parse(req.query);
  const conditions: Record<string, any> = {};

  if (validatedQuery.minWorth !== undefined) {
    conditions.orderWorth = { gte: validatedQuery.minWorth };
  }
  if (validatedQuery.maxWorth !== undefined) {
    conditions.orderWorth = {
      ...(conditions.orderWorth || {}),
      lte: validatedQuery.maxWorth,
    };
  }

  // Fetch orders including related products from the database
  const orders = await prisma.order.findMany({
    where: conditions,
    include: { products: true },
  });

  if (orders.length === 0) {
    throw new OrdersNotFoundError('No orders matching the criteria');
  }

  // Format orders to the required structure
  // In the CSV export the 'products' field is a JSON string
  const formattedOrders: ApiOrderResponse[] = orders.map((order) => ({
    orderID: order.orderID,
    orderWorth: order.orderWorth,
    products: order.products.map((p: any) => ({
      productID: p.productID,
      quantity: p.quantity,
    })),
  }));

  // conver to csv using external library
  const csv = json2csv(formattedOrders, { expandArrayObjects: true });

  // Set response headers and send the CSV content
  res.header('Content-Type', 'text/csv');
  res.attachment('orders.csv');
  res.send(csv);
};

export const getOrder = async (req: Request, res: Response) => {
  const { orderID } = orderIDSchema.parse({ orderID: req.params.orderID });

  const order = await prisma.order.findUnique({
    where: { orderID },
    include: { products: true },
  });

  if (!order) {
    throw new OrderNotFoundError(`Order with ID "${orderID}" was not found`);
  }

  const formattedOrder: ApiOrderResponse = {
    orderID: order.orderID,
    orderWorth: order.orderWorth,
    products: order.products.map((p) => ({
      productID: p.productID,
      quantity: p.quantity,
    })),
  };

  res.status(200).json(formattedOrder);
};
