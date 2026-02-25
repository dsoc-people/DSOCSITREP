import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const favoriteLocations = pgTable("favorite_locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lat: text("lat").notNull(),
  lon: text("lon").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLocationSchema = createInsertSchema(favoriteLocations).omit({ id: true, createdAt: true });

export type Location = typeof favoriteLocations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;

export type CreateLocationRequest = InsertLocation;
export type LocationResponse = Location;
export type LocationsListResponse = Location[];
