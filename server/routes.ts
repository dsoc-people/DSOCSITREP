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

  app.get("/api/weather/alerts", async (req, res) => {
    try {
      // Warren County, KY Zone is KYZ071 (Public) or KYC227 (County)
      // The user mentioned Warren Co KY, which maps to zone KYZ071 for alerts
      const zone = req.query.zone as string || 'KYZ071';
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
          urgency: props.urgency || 'Unknown',
          expires: props.expires || null
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

  app.get("/api/weather/afd", async (req, res) => {
    try {
      // AFD for LMK (Louisville, KY)
      const response = await fetch("https://api.weather.gov/products/types/AFD/locations/LMK");
      if (!response.ok) throw new Error("NWS AFD list fetch failed");
      const listData = await response.json();
      const latestProductUrl = listData['@graph']?.[0]?.['@id'];
      
      if (!latestProductUrl) throw new Error("No AFD product found");
      
      const productResponse = await fetch(latestProductUrl);
      if (!productResponse.ok) throw new Error("NWS AFD product fetch failed");
      const productData = await productResponse.json();
      
      res.json({ text: productData.productText });
    } catch (error) {
      console.error('AFD fetch error:', error);
      res.status(500).json({ message: "Failed to fetch AFD" });
    }
  });

  app.get("/api/weather/sounding", async (req, res) => {
    try {
      // Sounding for OHX (Nashville, TN)
      // Note: NWS API doesn't provide raw sounding text directly in a simple way like AFD
      // We'll fetch the latest RAOB/Upper Air product for OHX if available
      const response = await fetch("https://api.weather.gov/products/types/SOU/locations/OHX");
      if (!response.ok) {
        // Fallback to checking for other upper air products if SOU isn't used
        const altResponse = await fetch("https://api.weather.gov/products/types/UA/locations/OHX");
        if (!altResponse.ok) throw new Error("NWS Sounding fetch failed");
        const listData = await altResponse.json();
        const latestProductUrl = listData['@graph']?.[0]?.['@id'];
        if (!latestProductUrl) throw new Error("No Sounding product found");
        const productResponse = await fetch(latestProductUrl);
        const productData = await productResponse.json();
        return res.json({ text: productData.productText });
      }
      
      const listData = await response.json();
      const latestProductUrl = listData['@graph']?.[0]?.['@id'];
      if (!latestProductUrl) throw new Error("No Sounding product found");
      
      const productResponse = await fetch(latestProductUrl);
      const productData = await productResponse.json();
      res.json({ text: productData.productText });
    } catch (error) {
      console.error('Sounding fetch error:', error);
      res.status(500).json({ message: "Failed to fetch sounding" });
    }
  });

  return httpServer;
}
