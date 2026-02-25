import { pgTable, text, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lat: text("lat").notNull(),
  lon: text("lon").notNull(),
});

export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locations.$inferSelect;

export type CreateLocationRequest = InsertLocation;
export type LocationResponse = Location;

export type WeatherAlert = {
  id: string;
  event: string;
  headline: string;
  description: string;
  severity: string;
  urgency: string;
};

export type WeatherAlertsResponse = {
  warnings: WeatherAlert[];
  watches: WeatherAlert[];
  advisories: WeatherAlert[];
};
