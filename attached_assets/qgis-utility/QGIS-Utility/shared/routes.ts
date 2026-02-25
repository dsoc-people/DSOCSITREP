import { z } from 'zod';
import { insertLocationSchema, locations } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  locations: {
    list: {
      method: 'GET' as const,
      path: '/api/locations' as const,
      responses: {
        200: z.array(z.custom<typeof locations.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/locations' as const,
      input: insertLocationSchema,
      responses: {
        201: z.custom<typeof locations.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/locations/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    }
  },
  weather: {
    alerts: {
      method: 'GET' as const,
      path: '/api/weather/alerts' as const,
      input: z.object({
        zone: z.string().optional()
      }).optional(),
      responses: {
        200: z.object({
          warnings: z.array(z.any()),
          watches: z.array(z.any()),
          advisories: z.array(z.any())
        }),
        500: errorSchemas.internal
      }
    },
    observation: {
      method: 'GET' as const,
      path: '/api/weather/observation' as const,
      responses: {
        200: z.object({
          temp: z.any(),
          dewpoint: z.any(),
          windSpeed: z.any(),
          windDir: z.any(),
          windGust: z.any(),
          wetBulb: z.any()
        })
      }
    },
    forecast: {
      method: 'GET' as const,
      path: '/api/weather/forecast' as const,
      responses: {
        200: z.array(z.any())
      }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
