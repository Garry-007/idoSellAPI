import { z } from 'zod';

export const orderQuerySchema = z
  .object({
    minWorth: z.preprocess(
      (val) => (typeof val === 'string' ? Number(val) : val),
      z
        .number({
          invalid_type_error: 'Value should be a number',
        })
        .min(0, { message: 'Value should be a number' })
        .optional(),
    ),
    maxWorth: z.preprocess(
      (val) => (typeof val === 'string' ? Number(val) : val),
      z
        .number({
          invalid_type_error: 'Value should be a number',
        })
        .min(0, { message: 'Value should be a number' })
        .optional(),
    ),
  })
  .superRefine((data, ctx) => {
    if (
      data.minWorth !== undefined &&
      data.maxWorth !== undefined &&
      data.maxWorth < data.minWorth
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'maxWorth must be greater than or equal to minWorth',
        path: ['maxWorth'],
      });
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minWorth must be less than or equal to maxWorth',
        path: ['minWorth'],
      });
    }
  });

export const apiKeySchema = z.object({
  'x-api-key': z
    .string({
      required_error: 'API key is required in the x-api-key header.',
    })
    .trim()
    .min(1, 'API key cannot be empty'),
});

export const orderIDSchema = z.object({
  orderID: z
    .string({
      required_error: 'orderID is required as a query parameter.',
    })
    .trim()
    .min(1, 'orderID cannot be empty'),
});
