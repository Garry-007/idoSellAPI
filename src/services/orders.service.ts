import prisma from '../db';
import { ExternalAPIError } from '../errors';
import { formatDateForIdoSell } from '../utils';

// Response structure from the IdoSell API
interface IdoSellApiResponse {
  Results: IdoSellApiOrder[];
  resultsNumberAll: number;
  resultsNumberPage: number;
  resultsLimit: number;
  resultsPage: number;
  errors?: {
    faultCode: number;
    faultString: string;
  };
}

// Structure of a single order from the IdoSell API
interface IdoSellApiOrder {
  orderId: string;
  orderDetails: {
    orderChangeDate: string;
    payments: {
      orderBaseCurrency: {
        orderProductsCost: number;
      };
    };
    productsResults: {
      productId: number;
      productQuantity: number;
    }[];
  };
}

// Simplified internal order representation
interface IdoSellOrder {
  orderID: string;
  products: {
    productID: number;
    quantity: number;
  }[];
  orderWorth: number;
  orderChangeDate: string;
}

class OrdersService {
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly limit = 100; // Maximum number of orders per API request

  constructor() {
    this.apiUrl = `https://${process.env.ORDERS_DOMAIN}/api/admin/v4/orders/orders/get`;
    this.apiKey = process.env.ORDERS_KEY ?? '';
  }

  private mapApiOrder(apiOrder: IdoSellApiOrder): IdoSellOrder {
    return {
      orderID: apiOrder.orderId,
      orderWorth:
        apiOrder.orderDetails.payments.orderBaseCurrency.orderProductsCost,
      products:
        apiOrder.orderDetails.productsResults?.map((prod) => ({
          productID: prod.productId,
          quantity: prod.productQuantity,
        })) ?? [],
      orderChangeDate: apiOrder.orderDetails.orderChangeDate,
    };
  }

  private async fetchPage(
    page: number,
    ordersDateBegin?: string,
  ): Promise<IdoSellApiResponse> {
    const requestBody = {
      params: {
        resultsLimit: this.limit,
        resultsPage: page,
        ...(ordersDateBegin && {
          ordersRange: {
            ordersDateRange: {
              ordersDateType: 'modified',
              ordersDateBegin,
            },
          },
        }),
      },
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Status 207 indicates no results found - return empty response
    if (response.status === 207) {
      return {
        Results: [],
        resultsNumberAll: 0,
        resultsNumberPage: 0,
        resultsLimit: 0,
        resultsPage: 0,
      };
    }

    // Handle other error status codes
    if (!response.ok) {
      throw new ExternalAPIError(
        `Error fetching orders (status ${response.status}): ${response.statusText}`,
      );
    }

    const data = (await response.json()) as IdoSellApiResponse;
    return data;
  }

  async fetchAllOrders(ordersDateBegin?: string): Promise<IdoSellOrder[]> {
    // Fetch first page to get pagination information
    const initialData = await this.fetchPage(0, ordersDateBegin);

    // Return empty array if no results
    if (initialData.Results.length === 0) {
      return [];
    }

    // Process the first page of results
    const orders: IdoSellOrder[] = initialData.Results.map((order) =>
      this.mapApiOrder(order),
    );

    // Fetch remaining pages in parallel
    const remainingPages = Array.from(
      { length: initialData.resultsNumberPage - 1 },
      (_, i) => i + 1,
    );

    const additionalResults = await Promise.all(
      remainingPages.map((page) => this.fetchPage(page, ordersDateBegin)),
    );

    // Combine all results
    additionalResults.forEach((pageData) => {
      orders.push(...pageData.Results.map((order) => this.mapApiOrder(order)));
    });

    return orders;
  }

  // concurrencyLimit of 17 is the limit in my test database
  async processOrders(
    orders: IdoSellOrder[],
    concurrencyLimit: number = 17,
    batchSize: number = 50,
  ): Promise<void> {
    const startTime = Date.now();
    const chunks = this.chunkArray(orders, batchSize);
    let processedChunks = 0;
    let failedChunks = 0;
    let currentChunkIndex = 0;
    const MAX_RETRY_ATTEMPTS = 3;

    console.log(
      `Starting to process ${orders.length} order(s) in ${chunks.length} chunk(s)`,
    );

    // This retryQueue holds failed chunks and their attempts so far.
    const retryQueue: Array<{ chunk: IdoSellOrder[]; attempts: number }> = [];

    // Process one chunk in a one transaction.
    const processChunk = async (chunk: IdoSellOrder[], chunkIndex: number) => {
      await prisma.$transaction(
        async (tx) => {
          const orderIds = chunk.map((order) => order.orderID);

          // Fetch orders to check which ones exist.
          const existingOrders = await tx.order.findMany({
            where: { orderID: { in: orderIds } },
            select: { id: true, orderID: true },
          });
          const existingOrderMap = new Map(
            existingOrders.map((o) => [o.orderID, o.id]),
          );

          // Separate orders into ones to update (existing) and to create (new)
          const ordersToUpdate: IdoSellOrder[] = [];
          const ordersToCreate: IdoSellOrder[] = [];
          for (const order of chunk) {
            if (existingOrderMap.has(order.orderID)) {
              ordersToUpdate.push(order);
            } else {
              ordersToCreate.push(order);
            }
          }

          // If updating, remove related products first.
          if (ordersToUpdate.length > 0) {
            await tx.productSale.deleteMany({
              where: {
                orderId: {
                  in: ordersToUpdate.map(
                    (o) => existingOrderMap.get(o.orderID)!,
                  ),
                },
              },
            });
          }

          // Create new orders.
          if (ordersToCreate.length > 0) {
            await tx.order.createMany({
              data: ordersToCreate.map((order) => ({
                orderID: order.orderID,
                orderWorth: order.orderWorth,
                modifiedAt: new Date(order.orderChangeDate),
              })),
            });
          }

          // Update existing orders.
          await Promise.all(
            ordersToUpdate.map((order) =>
              tx.order.update({
                where: { orderID: order.orderID },
                data: {
                  orderWorth: order.orderWorth,
                  modifiedAt: new Date(order.orderChangeDate),
                },
              }),
            ),
          );

          // Fetch all orders (updated and newly created) to build a map of id's.
          const allOrders = await tx.order.findMany({
            where: { orderID: { in: orderIds } },
            select: { id: true, orderID: true },
          });
          const orderIdMap = new Map(allOrders.map((o) => [o.orderID, o.id]));

          // Create all products.
          const allProducts = chunk.flatMap((order) =>
            order.products.map((product) => ({
              orderId: orderIdMap.get(order.orderID)!,
              productID: product.productID,
              quantity: product.quantity,
            })),
          );
          if (allProducts.length > 0) {
            await tx.productSale.createMany({ data: allProducts });
          }
        },
        {
          maxWait: 5000,
          timeout: 10000,
        },
      );
      processedChunks++;
      console.log(
        `Chunk ${chunkIndex + 1}/${chunks.length} processed (${chunk.length} order(s))`,
      );
    };

    // Worker function that processes chunks sequentially.
    const worker = async (workerId: number) => {
      while (currentChunkIndex < chunks.length) {
        const idx = currentChunkIndex++;
        const chunk = chunks[idx];

        try {
          await processChunk(chunk, idx);
        } catch (error) {
          failedChunks++;
          console.error(
            `Worker ${workerId} failed for chunk ${idx + 1}:`,
            error,
          );

          // Push to retry if not already in the retry queue.
          if (!retryQueue.find((r) => r.chunk === chunk)) {
            retryQueue.push({ chunk, attempts: 1 });
          }
        }
      }
    };

    // Run workers in parallel.
    await Promise.all(
      Array.from({ length: concurrencyLimit }, (_, i) => worker(i + 1)),
    );

    // Process retry queue.
    if (retryQueue.length > 0) {
      console.log(`Retrying ${retryQueue.length} failed chunk(s)...`);
      for (const retry of retryQueue) {
        while (retry.attempts < MAX_RETRY_ATTEMPTS) {
          try {
            // Use the chunk's original index for log purposes.
            const idx = chunks.indexOf(retry.chunk);
            await processChunk(retry.chunk, idx);
            // On success, set attempts to max to break the loop.
            retry.attempts = MAX_RETRY_ATTEMPTS;
          } catch (error) {
            retry.attempts++;
            console.error(
              `Retry attempt ${retry.attempts} for chunk failed:`,
              error,
            );
          }
        }
      }
    }

    const duration = Date.now() - startTime;
    const totalProcessed = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const successRate = ((processedChunks / chunks.length) * 100).toFixed(2);
    console.log(`
  Processing completed:
  - Total time: ${(duration / 1000).toFixed(2)}s
  - Processed: ${totalProcessed} orders
  - Success rate: ${successRate}%
  - Failed chunks: ${failedChunks}
  - Remaining retry queue: ${retryQueue.filter((r) => r.attempts < MAX_RETRY_ATTEMPTS).length}
    `);

    // Throw error if any chunks failed permanently
    if (retryQueue.length > 0) {
      throw new Error(
        `Failed to process ${retryQueue.length} chunks after ${MAX_RETRY_ATTEMPTS} attempts`,
      );
    }
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(array.length / size) }, (_, index) =>
      array.slice(index * size, (index + 1) * size),
    );
  }
}

export const updateOrders = async () => {
  const ordersService = new OrdersService();

  // Using the most recent modifiedAt ensures minimal overlap while
  // preventing race conditions that could result in missing an order.
  const latestOrder = await prisma.order.findFirst({
    orderBy: { modifiedAt: 'desc' },
    select: { modifiedAt: true },
  });

  const ordersDateBegin = latestOrder?.modifiedAt
    ? formatDateForIdoSell(latestOrder.modifiedAt)
    : '';

  const orders = await ordersService.fetchAllOrders(ordersDateBegin);
  console.log('Length of received orders: ', orders.length);

  await ordersService.processOrders(orders);
};
