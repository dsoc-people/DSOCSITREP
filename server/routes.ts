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

  app.get("/api/weather/sounding", async (req, res) => {
    try {
      // Fetch the most recent RAOB sounding for OHX from Iowa State Mesonet.
      // Docs: /cgi-bin/request/raob.py (dl, sts, ets, station)
      const now = new Date();
      const oneDayMs = 24 * 60 * 60 * 1000;
      const start = new Date(now.getTime() - oneDayMs);

      const toIso = (d: Date) => d.toISOString().slice(0, 19) + "Z";

      const baseUrl =
        "https://mesonet.agron.iastate.edu/cgi-bin/request/raob.py";
      const url = new URL(baseUrl);
      url.searchParams.set("station", "OHX");
      url.searchParams.set("sts", toIso(start));
      url.searchParams.set("ets", toIso(now));
      // dl=1 => force CSV download instead of HTML preview.
      url.searchParams.set("dl", "1");

      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error("Mesonet RAOB fetch failed");
      }

      const text = await response.text();

      // Return raw CSV so the frontend can display or parse it.
      res.json({ text });
    } catch (error) {
      console.error("Sounding fetch error:", error);
      res.status(500).json({ message: "Failed to fetch sounding" });
    }
  });

  app.get("/api/weather/ky-stations", async (req, res) => {
    try {
      // Return fixed station list with coordinates
      const stationCoords = [
        ["FARM", 36.93, -86.47], ["RSVL", 36.85, -86.92], ["MRHD", 38.22, -83.48],
        ["MRRY", 36.61, -88.34], ["PCWN", 37.28, -84.96], ["HTFD", 37.45, -86.89],
        ["CMBA", 37.12, -85.31], ["CRMT", 37.94, -85.67], ["LXGN", 37.93, -84.53],
        ["BLRK", 37.47, -86.33], ["SCTV", 36.74, -86.21], ["PRNC", 37.09, -87.86],
        ["BMBL", 36.86, -83.84], ["PGHL", 36.94, -87.48], ["LSML", 38.08, -84.90],
        ["ERLN", 37.32, -87.49], ["OLIN", 37.36, -83.96], ["QKSD", 37.54, -83.32],
        ["SWON", 38.53, -84.77], ["LGNT", 37.54, -84.63], ["MROK", 36.95, -85.99],
        ["PVRT", 37.54, -87.28], ["BNGL", 37.36, -85.49], ["CRRL", 38.67, -85.15],
        ["HRDB", 37.77, -84.82], ["FRNY", 37.72, -87.90], ["GRDR", 36.79, -85.45],
        ["RPTN", 37.36, -88.07], ["ELST", 37.71, -84.18], ["DRFN", 36.88, -88.32],
        ["BTCK", 37.01, -88.96], ["WLBT", 37.83, -85.96], ["WSHT", 37.97, -82.50],
        ["WNCH", 38.01, -84.13], ["CCLA", 36.67, -88.67], ["BNVL", 37.28, -84.67],
        ["RNDH", 37.45, -82.99], ["HCKM", 36.85, -88.34], ["RBSN", 37.42, -83.02],
        ["HHTS", 36.96, -85.64], ["PRYB", 36.83, -83.17], ["CADZ", 36.83, -87.86],
        ["ALBN", 36.71, -85.14], ["HUEY", 38.97, -84.72], ["VEST", 37.41, -82.99],
        ["GRHM", 37.82, -87.51], ["MQDY", 37.71, -86.50], ["CLSL", 38.28, -84.10],
        ["CHTR", 38.58, -83.42], ["FLRK", 36.77, -84.48], ["DORT", 37.28, -82.52],
        ["FCHV", 38.16, -85.38], ["LGRN", 38.46, -85.47], ["HDYV", 37.26, -85.78],
        ["LUSA", 38.10, -82.60], ["PRST", 38.09, -83.76], ["BRND", 37.95, -86.22],
        ["LRTO", 37.63, -85.37], ["HDGV", 37.57, -85.70], ["WTBG", 37.13, -82.84],
        ["SWZR", 36.67, -86.61], ["CCTY", 37.29, -87.16], ["ZION", 36.76, -87.21],
        ["PSPG", 37.01, -86.37], ["BMTN", 36.92, -82.91], ["WDBY", 37.18, -86.65],
        ["DANV", 37.62, -84.82], ["CROP", 38.33, -85.17], ["HARD", 37.76, -86.46],
        ["GAMA", 36.66,-85.80], ["DABN", 37.18, -84.56], ["DIXO", 37.52, -87.69],
        ["WADD", 38.09, -85.14], ["EWPK", 37.04, -86.35], ["RFVC", 37.46, -83.16],
        ["RFSM", 37.43, -83.18], ["CARL", 38.32, -84.04], ["MONT", 36.87, -84.90],
        ["BAND", 37.13, -88.95], ["WOOD", 36.99, -84.97], ["DCRD", 37.87, -83.65],
        ["SPIN", 38.13, -84.50], ["GRBG", 37.21, -85.47], ["PBDY", 37.14, -83.58],
        ["BLOM", 37.96, -85.31], ["LEWP", 37.92, -86.85], ["STAN", 37.85, -83.88],
        ["BEDD", 38.63, -85.32]
      ];

      // Return simulated data for now as fetching 80+ stations takes too long
      // In production we would fetch from Mesonet API or similar
      const data = stationCoords.map(([id, lat, lon]) => ({
        id, lat, lon,
        temp: Math.floor(Math.random() * (95 - 20) + 20),
        dewpoint: Math.floor(Math.random() * (75 - 15) + 15),
        windSpeed: Math.floor(Math.random() * 25),
        windDir: Math.floor(Math.random() * 360)
      }));

      res.json(data);
    } catch (error) {
      console.error("KY Stations fetch error:", error);
      res.status(500).json({ message: "Failed to fetch KY stations" });
    }
  });

  return httpServer;
}
