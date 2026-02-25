import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

async function seedDatabase() {
  const existing = await storage.getLocations();
  if (existing.length === 0) {
    await storage.createLocation({ name: "Bowling Green, KY", lat: "36.9903", lon: "-86.4436" });
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await seedDatabase();

  app.get(api.locations.list.path, async (req, res) => {
    const locations = await storage.getLocations();
    // Force only Bowling Green as requested
    const bgOnly = locations.filter(l => l.name.includes("Bowling Green"));
    res.json(bgOnly);
  });

  app.get("/api/weather/observation", async (req, res) => {
    try {
      const response = await fetch("https://cdn.weatherstem.com/dashboard/data/dynamic/model/warren/wkuchaos/latest.json");
      if (!response.ok) throw new Error("Weatherstem fetch failed");
      const data = await response.json();

      const records = data.records || [];

      // FIXED: use sensor_name and value
      const findReading = (sensor: string) =>
        records.find((r: any) => r.sensor_name === sensor)?.value ?? "N/A";

      res.json({
        temp: findReading("Thermometer"),
        dewpoint: findReading("Dewpoint"),
        windSpeed: findReading("Anemometer"),
        windDir: findReading("Wind Vane"),
        windGust: findReading("10 Minute Wind Gust"),
        wetBulb:
          findReading("Wet Bulb Globe Temperature") !== "N/A"
            ? findReading("Wet Bulb Globe Temperature")
            : findReading("Heat Index")
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch observation" });
    }
  });

  app.get("/api/weather/forecast", async (req, res) => {
    try {
      // Bowling Green NWS Grid: LMK/49,43
      const response = await fetch("https://api.weather.gov/gridpoints/LMK/49,43/forecast");
      if (!response.ok) throw new Error("NWS Forecast fetch failed");
      const data = await response.json();
      res.json(data.properties.periods);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch forecast" });
    }
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
    res.status(204).send();
  });

  app.get(api.weather.alerts.path, async (req, res) => {
    try {
      const zone = req.query.zone as string || 'KYC021';
      const response = await fetch(`https://api.weather.gov/alerts/active?zone=${zone}`);

      if (!response.ok) {
        return res.status(500).json({ message: 'Failed to fetch weather alerts' });
      }

      const data = await response.json();
      const features = data.features || [];

      const warnings: any[] = [];
      const watches: any[] = [];
      const advisories: any[] = [];

      features.forEach((feature: any) => {
        const props = feature.properties;
        const alert = {
          id: props.id,
          event: props.event || 'Unknown',
          headline: props.headline || 'No headline',
          description: props.description || 'No description',
          severity: props.severity || 'Unknown',
          urgency: props.urgency || 'Unknown'
        };

        const eventLower = props.event?.toLowerCase() || '';
        if (eventLower.includes('warning')) {
          warnings.push(alert);
        } else if (eventLower.includes('watch')) {
          watches.push(alert);
        } else if (eventLower.includes('advisory') || eventLower.includes('statement')) {
          advisories.push(alert);
        }
      });

      res.json({ warnings, watches, advisories });
    } catch (error) {
      console.error('Weather alerts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  return httpServer;
}