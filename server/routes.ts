import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

async function seedDatabase() {
  const existingLocations = await storage.getLocations();
  if (existingLocations.length === 0) {
    await storage.createLocation({ name: "New York (JFK)", lat: "40.6413", lon: "-73.7781" });
    await storage.createLocation({ name: "Los Angeles (LAX)", lat: "33.9416", lon: "-118.4085" });
    await storage.createLocation({ name: "Chicago (ORD)", lat: "41.9742", lon: "-87.9073" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get(api.locations.list.path, async (req, res) => {
    const locations = await storage.getLocations();
    res.json(locations);
  });

  app.post(api.locations.create.path, async (req, res) => {
    try {
      const input = api.locations.create.input.parse(req.body);
      const location = await storage.createLocation(input);
      res.status(201).json(location);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.delete(api.locations.delete.path, async (req, res) => {
    await storage.deleteLocation(Number(req.params.id));
    res.status(204).end();
  });

  await seedDatabase();

  return httpServer;
}
