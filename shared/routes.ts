import { z } from 'zod';
import { insertLocationSchema, favoriteLocations } from './schema';

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
        200: z.array(z.custom<typeof favoriteLocations.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/locations' as const,
      input: insertLocationSchema,
      responses: {
        201: z.custom<typeof favoriteLocations.$inferSelect>(),
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

export type LocationInput = z.infer<typeof api.locations.create.input>;
export type LocationResponse = z.infer<typeof api.locations.create.responses[201]>;
export type LocationsListResponse = z.infer<typeof api.locations.list.responses[200]>;
