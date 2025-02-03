import prisma from '../db';
import { ExternalAPIError } from '../errors';

// Respons returned by the external API
interface IdoSellApiResponse {
  Results: IdoSellApiOrder[];
  resultsNumberAll: number;
  resultsNumberPage: number;
  resultsLimit: number;
  resultsPage: number;
}

// Paths to the specific fields that needs to be read
interface IdoSellApiOrder {
  orderId: string;
  orderDetails: {
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

// Interface to the data format this API returns
export interface IdoSellOrder {
  orderID: string;
  products: {
    productID: number;
    quantity: number;
  }[];
  orderWorth: number;
}

const fetchIdoSellOrders = async (): Promise<IdoSellOrder[]> => {
  const orders: IdoSellOrder[] = [];
  const limit = 100;
  const url = `https://${process.env.ORDERS_DOMAIN}/api/admin/v4/orders/orders/get`;

  // Function to map an API order to our IdoSellOrder interface
  const mapApiOrder = (apiOrder: IdoSellApiOrder): IdoSellOrder => {
    const orderWorth =
      apiOrder.orderDetails.payments.orderBaseCurrency.orderProductsCost;

    const products =
      apiOrder.orderDetails.productsResults?.map((prod) => ({
        productID: prod.productId,
        quantity: prod.productQuantity,
      })) ?? [];

    return {
      orderID: apiOrder.orderId,
      orderWorth,
      products,
    };
  };

  // Fetch the first page to get the pagination information.
  const initialResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.ORDERS_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      params: { resultsLimit: limit, resultsPage: 0 },
    }),
  });

  if (!initialResponse.ok) {
    throw new ExternalAPIError(
      `Error fetching orders: ${initialResponse.statusText}`,
    );
  }

  const initialData = (await initialResponse.json()) as IdoSellApiResponse;
  orders.push(...initialData.Results.map(mapApiOrder));

  // Determine total pages
  const totalPages = initialData.resultsNumberPage;

  // Prepare parallel requests for the remaining pages.
  const fetchRequests: Promise<IdoSellApiResponse>[] = [];
  for (let currentPage = 1; currentPage < totalPages; currentPage++) {
    const requestBody = JSON.stringify({
      params: { resultsLimit: limit, resultsPage: currentPage },
    });
    fetchRequests.push(
      fetch(url, {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.ORDERS_KEY ?? '',
          'Content-Type': 'application/json',
        },
        body: requestBody,
      }).then(async (res) => {
        if (!res.ok) {
          throw new ExternalAPIError(
            `Error fetching page ${currentPage}: ${res.statusText}`,
          );
        }

        return res.json() as Promise<IdoSellApiResponse>;
      }),
    );
  }

  const pagesData = await Promise.all(fetchRequests);

  // Process each page's results.
  for (const pageData of pagesData) {
    orders.push(...pageData.Results.map(mapApiOrder));
  }

  return orders;
};

export const updateOrders = async () => {
  const orders = await fetchIdoSellOrders();
  // value specific to my database
  const concurrencyLimit = 17;
  let currentIndex = 0;

  // Worker function that processes orders one by one
  async function worker() {
    while (currentIndex < orders.length) {
      // Grab the current order and increment the index.
      const order = orders[currentIndex];
      currentIndex++;

      // perform the upsert operation for this order.
      await prisma.order.upsert({
        where: { orderID: order.orderID },
        update: {
          orderWorth: order.orderWorth,
          products: {
            deleteMany: {},
            create: order.products.map((p) => ({
              productID: p.productID,
              quantity: p.quantity,
            })),
          },
        },
        create: {
          orderID: order.orderID,
          orderWorth: order.orderWorth,
          products: {
            create: order.products.map((p) => ({
              productID: p.productID,
              quantity: p.quantity,
            })),
          },
        },
      });
    }
  }

  // launch a pool of workers
  const workers = [];
  for (let i = 0; i < concurrencyLimit; i++) {
    workers.push(worker());
  }

  // wait until all workers have finished processing
  await Promise.all(workers);
};
