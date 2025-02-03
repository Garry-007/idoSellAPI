# API Documentation

This API provides endpoints to query orders and export order data as CSV. It also includes built-in validation and authentication. The API uses Express, Prisma, and Zod for data validation.

**Deployed API Endpoint:**  
The API is deployed at [https://idosellapi.onrender.com](https://idosellapi.onrender.com). Please note that the instance may go to sleep during inactivity, so the initial request after a period of inactivity can take up to 1 minute.

## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
- [Endpoints](#endpoints)
  - [GET /ordersCSV](#get-orderscsv)
  - [GET /order/:orderID](#get-orderorderid)
- [Authentication](#authentication)
- [Access Keys](#access-keys)

## Installation

Clone the repository and install its dependencies:

```bash
git clone https://github.com/Garry-007/idoSellAPI
cd idoSellAPI
npm install
```

### Environment Setup

A `.env.example` file is included to help you set up your environment variables. Copy it to create your own `.env` file and fill in the required values:

```dotenv
# .env.example
DATABASE_URL=
ORDERS_DOMAIN=
ORDERS_KEY=
NODE_ENV=production
```

Copy the example file with:

```bash
cp .env.example .env
```

### Prisma Setup

After configuring your `.env` file with the proper `DATABASE_URL`, generate the Prisma client and run the initial migration:

```bash
npx prisma generate
npx prisma migrate deploy
```

Then, start the server:

```bash
npm run dev
```

Keep in mind that authentication requires that the user is added to the database with their password hashed using bcrypt.

## Usage

All API calls require proper authentication and valid query parameters. Requests can be made using tools like cURL or Postman. When accessing the deployed API, use the URL [https://idosellapi.onrender.com](https://idosellapi.onrender.com).

## Endpoints

### GET /ordersCSV

Exports orders as a CSV file. The orders can be filtered by their worth using optional query parameters.

#### Query Parameters

- **minWorth (optional):** Minimum order worth. Must be a number.
- **maxWorth (optional):** Maximum order worth. Must be a number.  
  _Constraint:_ If both are used, `maxWorth` must be greater than or equal to `minWorth`.

#### Example Request

```bash
curl -X GET "https://idosellapi.onrender.com/api/ordersCSV?minWorth=100&maxWorth=1000" \
  -H "Authorization: Basic dGVzdFVzZXI6SlJuNVZLU2Y0UzZTTFRJYjRibkQxelNhcXNUMWUwdWROOXBRVm8xempwd2l1bEhhaHM=" \
  -o orders.csv
```

### GET /order/:orderID

Retrieves a single order by its `orderID`.

#### URL Parameters

- **orderID:** The unique identifier of the order.

#### Example Request

```bash
curl -X GET "https://idosellapi.onrender.com/api/order/tesest-1" \
  -H "Authorization: Basic dGVzdFVzZXI6SlJuNVZLU2Y0UzZTTFRJYjRibkQxelNhcXNUMWUwdWROOXBRVm8xempwd2l1bEhhaHM="
```

#### Example Response

```json
{
  "orderID": "tesest-1",
  "orderWorth": 150.0,
  "products": [
    {
      "productID": "prod-1",
      "quantity": 2
    },
    {
      "productID": "prod-2",
      "quantity": 1
    }
  ]
}
```

## Authentication

The protected routes use HTTP Basic authentication. Include an `Authorization` header with credentials in the format:

```raw
Authorization: Basic <base64encoded username:password>
```

If the credentials are invalid, the API will return an authentication error.

## Access Keys

For the purposes of this project, you can use the following access keys with Basic authentication. The database contains only test data.

- **Username:** `testUser`
- **Password:** `JRn5VKSf4S6SLTIb4bnD1zSaqsT1e0udN9pQVo1zjpwiulHahs`

**Example:**  
Encode the credentials using Base64:

```bash
echo -n "testUser:JRn5VKSf4S6SLTIb4bnD1zSaqsT1e0udN9pQVo1zjpwiulHahs" | base64
```

Use the resulting string in the `Authorization` header:

```raw
Authorization: Basic <base64encoded testUser:JRn5VKSf4S6SLTIb4bnD1zSaqsT1e0udN9pQVo1zjpwiulHahs>
```
