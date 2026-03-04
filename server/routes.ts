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
      // Fetch all active alerts for the entire state of Kentucky
      const response = await fetch(`https://api.weather.gov/alerts/active?area=KY`);

      if (!response.ok) {
        return res.status(500).json({ message: 'Failed to fetch weather alerts' });
      }

      const data = await response.json();
      const features = data.features || [];

      const warnings: any[] = [];
      const watches: any[] = [];
      const advisories: any[] = [];

      // Map: UGC code -> highest-priority category for that zone
      const ugcCategory = new Map<string, string>();

      features.forEach((feature: any) => {
        const props = feature.properties;
        const eventLower = props.event?.toLowerCase() || '';

        let category = 'advisory';
        if (eventLower.includes('warning')) category = 'warning';
        else if (eventLower.includes('watch')) category = 'watch';

        const alert = {
          id: props.id,
          event: props.event || 'Unknown',
          headline: props.headline || 'No headline',
          description: props.description || 'No description',
          severity: props.severity || 'Unknown',
          urgency: props.urgency || 'Unknown',
          expires: props.expires || null
        };

        if (category === 'warning') warnings.push(alert);
        else if (category === 'watch') watches.push(alert);
        else advisories.push(alert);

        // Collect KY UGC codes (county: KYCxxx, forecast zone: KYZxxx)
        const ugcCodes: string[] = props.geocode?.UGC || [];
        ugcCodes
          .filter((c: string) => c.startsWith('KY'))
          .forEach((c: string) => {
            // Warning > Watch > Advisory priority
            const existing = ugcCategory.get(c);
            if (!existing || category === 'warning' || (category === 'watch' && existing === 'advisory')) {
              ugcCategory.set(c, category);
            }
          });
      });

      // Fetch zone geometries for affected KY zones in two batch requests
      // (county zones KYCxxx and forecast zones KYZxxx)
      const allUgcCodes = Array.from(ugcCategory.keys());
      const countyCodes = allUgcCodes.filter(c => c[2] === 'C');
      const forecastCodes = allUgcCodes.filter(c => c[2] === 'Z');

      const fetchZoneBatch = async (type: string, codes: string[]) => {
        if (!codes.length) return [];
        try {
          const url = `https://api.weather.gov/zones/${type}?id=${codes.join(',')}&include_geometry=true`;
          const r = await fetch(url);
          if (!r.ok) return [];
          const json = await r.json();
          return (json.features || []) as any[];
        } catch {
          return [];
        }
      };

      const [countyZones, forecastZones] = await Promise.all([
        fetchZoneBatch('county', countyCodes),
        fetchZoneBatch('forecast', forecastCodes),
      ]);

      const mapFeatures = [...countyZones, ...forecastZones]
        .filter((f: any) => f.geometry)
        .map((f: any) => {
          const code = f.properties?.id as string;
          const category = ugcCategory.get(code) || 'advisory';
          return {
            type: 'Feature',
            geometry: f.geometry,
            properties: { event: code, category },
          };
        });

      res.json({ warnings, watches, advisories, mapFeatures });
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
      // Mesonet station list with coordinates (same IDs as your Streamlit app)
      const stationCoords: Array<[string, number, number]> = [
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
        ["GRHM", 37.82, -87.51],
        ["CHTR", 38.58, -83.42], ["FLRK", 36.77, -84.48], ["DORT", 37.28, -82.52],
        ["FCHV", 38.16, -85.38], ["LGRN", 38.46, -85.47], ["HDYV", 37.26, -85.78],
        ["LUSA", 38.10, -82.60], ["PRST", 38.09, -83.76], ["BRND", 37.95, -86.22],
        ["LRTO", 37.63, -85.37], ["HDGV", 37.57, -85.70], ["WTBG", 37.13, -82.84],
        ["SWZR", 36.67, -86.61], ["CCTY", 37.29, -87.16], ["ZION", 36.76, -87.21],
        ["BMTN", 36.92, -82.91], ["WDBY", 37.18, -86.65],
        ["DANV", 37.62, -84.82], ["CROP", 38.33, -85.17], ["HARD", 37.76, -86.46],
        ["GAMA", 36.66, -85.80], ["DABN", 37.18, -84.56], ["DIXO", 37.52, -87.69],
        ["WADD", 38.09, -85.14], ["EWPK", 37.04, -86.35], ["RFVC", 37.46, -83.16],
        ["RFSM", 37.43, -83.18], ["CARL", 38.32, -84.04], ["MONT", 36.87, -84.90],
        ["BAND", 37.13, -88.95], ["WOOD", 36.99, -84.97], ["DCRD", 37.87, -83.65],
        ["SPIN", 38.13, -84.50], ["GRBG", 37.21, -85.47], ["PBDY", 37.14, -83.58],
        ["BLOM", 37.96, -85.31], ["LEWP", 37.92, -86.85], ["STAN", 37.85, -83.88],
        ["BEDD", 38.63, -85.32],
      ];

      const now = new Date();
      const year = now.getFullYear().toString();
      const prevYear = (now.getFullYear() - 1).toString();

      async function fetchMesonetStation(
        id: string,
        lat: number,
        lon: number,
      ) {
        try {
          let manifestRes = await fetch(
            `https://d266k7wxhw6o23.cloudfront.net/data/${id}/${year}/manifest.json`,
          );
          if (!manifestRes.ok) {
            // Fall back to previous year if current year data not yet available
            manifestRes = await fetch(
              `https://d266k7wxhw6o23.cloudfront.net/data/${id}/${prevYear}/manifest.json`,
            );
          }
          if (!manifestRes.ok) {
            throw new Error("Mesonet manifest fetch failed");
          }
          const manifest = (await manifestRes.json()) as any;
          const days = Object.keys(manifest);
          if (!days.length) {
            throw new Error("Mesonet manifest empty");
          }
          days.sort();
          const latestDay = days[days.length - 1];
          const key = manifest[latestDay].key;

          const dataRes = await fetch(
            `https://d266k7wxhw6o23.cloudfront.net/${key}`,
          );
          if (!dataRes.ok) {
            throw new Error("Mesonet data fetch failed");
          }
          const data = (await dataRes.json()) as any;
          const rows: any[] = data.rows || [];
          const cols: string[] = data.columns || [];
          if (!rows.length || !cols.length) {
            throw new Error("Mesonet data missing rows/columns");
          }

          const colIndex = (name: string) => cols.indexOf(name);
          const last = rows[rows.length - 1];

          const tairC = last[colIndex("TAIR")];
          const dwptC = last[colIndex("DWPT")];
          const wspdMps = last[colIndex("WSPD")];
          const wdirDeg = last[colIndex("WDIR")];

          const toF = (c: unknown) =>
            typeof c === "number" && !Number.isNaN(c)
              ? Math.round((c * 9) / 5 + 32)
              : ("N/A" as const);

          const toMph = (mps: unknown) =>
            typeof mps === "number" && !Number.isNaN(mps)
              ? Math.round(mps * 2.23694)
              : ("N/A" as const);

          const toDeg = (d: unknown) =>
            typeof d === "number" && !Number.isNaN(d)
              ? Math.round(d)
              : ("N/A" as const);

          return {
            id,
            lat,
            lon,
            temp: toF(tairC),
            dewpoint: toF(dwptC),
            windSpeed: toMph(wspdMps),
            windDir: toDeg(wdirDeg),
          };
        } catch (err) {
          console.error(`Mesonet station fetch error for ${id}:`, err);
          return {
            id,
            lat,
            lon,
            temp: "N/A" as const,
            dewpoint: "N/A" as const,
            windSpeed: "N/A" as const,
            windDir: "N/A" as const,
          };
        }
      }

      type WeatherStemSite = {
        id: string;
        name: string;
        lat: number;
        lon: number;
        url: string;
      };

      const weatherStemSites: WeatherStemSite[] = [
        {
          id: "WKU",
          name: "WKU",
          lat: 36.9685,
          lon: -86.4708,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/warren/wku/latest.json",
        },
        {
          id: "WKUCHAOS",
          name: "WKU Chaos",
          lat: 36.98582726072027,
          lon: -86.44967208166477,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/warren/wkuchaos/latest.json",
        },
        {
          id: "WKUIMFIELDS",
          name: "WKU IM Fields",
          lat: 36.9742,
          lon: -86.4758,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/warren/wkuimfields/latest.json",
        },
        {
          id: "ETOWN",
          name: "E'town",
          lat: 37.6959,
          lon: -85.8789,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/hardin/wswelizabethtown/latest.json",
        },
        {
          id: "OWENSBORO",
          name: "Owensboro",
          lat: 37.7719,
          lon: -87.1112,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/daviess/wswowensboro/latest.json",
        },
        {
          id: "GLASGOW",
          name: "Glasgow",
          lat: 36.9959,
          lon: -85.9119,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/barren/wswglasgow/latest.json",
        },
        {
          id: "MAKERS_WAREHOUSE",
          name: "Maker's Mark Warehouse",
          lat: 37.6333457845,
          lon: -85.4075842212,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/marion-ky/makersmarkwarehouse/latest.json",
        },
        {
          id: "MAKERS_ST_MARY",
          name: "Maker's Mark St Mary",
          lat: 37.5707524233,
          lon: -85.3743790708,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/marion-ky/makersmarkstmary/latest.json",
        },
        {
          id: "MAKERS_LEBANON",
          name: "Maker's Mark Lebanon",
          lat: 37.5758692691,
          lon: -85.2736659636,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/marion-ky/makersmarklebanon/latest.json",
        },
        {
          id: "MAKERS_INNOVATION",
          name: "Maker's Mark Innovation Garden",
          lat: 37.64686,
          lon: -85.34895,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/marion-ky/makersmark/latest.json",
        },
        {
          id: "JB_BOOKER_NOE",
          name: "Jim Beam Booker Noe",
          lat: 37.8127589004,
          lon: -85.6849316392,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/nelson/jbbookernoe/latest.json",
        },
        {
          id: "JB_BARDSTOWN",
          name: "Jim Beam Bardstown",
          lat: 37.8344634433,
          lon: -85.4711423977,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/nelson/jbbardstown/latest.json",
        },
        {
          id: "JB_CLERMONT",
          name: "Jim Beam Clermont",
          lat: 37.9317945798,
          lon: -85.6520369416,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/bullitt/jbclermont/latest.json",
        },
        {
          id: "JB_OLD_CROW",
          name: "Jim Beam Old Crow",
          lat: 38.1463823354,
          lon: -84.8415031586,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/franklin-ky/jboldcrow/latest.json",
        },
        {
          id: "JB_GRAND_DAD",
          name: "Jim Beam Grand Dad",
          lat: 38.215725282,
          lon: -84.8093261477,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/franklin-ky/jbgranddad/latest.json",
        },
        {
          id: "WOODFORD_COURTHOUSE",
          name: "Woodford County Courthouse",
          lat: 38.052717,
          lon: -84.73067,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/woodford/courthouse/latest.json",
        },
        {
          id: "ADAIR_HS",
          name: "Adair County High School",
          lat: 37.107667,
          lon: -85.32824,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/adair/achs/latest.json",
        },
        {
          id: "CLINTON_HS",
          name: "Clinton County High School",
          lat: 36.708211,
          lon: -85.131276,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/clinton/clintonhs/latest.json",
        },
        {
          id: "NOVELIS_GUTHRIE",
          name: "Novelis Guthrie",
          lat: 36.6025431022,
          lon: -87.7186136559,
          url: "https://cdn.weatherstem.com/dashboard/data/dynamic/model/todd/novelis/latest.json",
        },
      ];

      const extractSensorValue = (records: any[], target: string) => {
        const lower = target.toLowerCase();
        const found = records.find(
          (r) =>
            typeof r.sensor_name === "string" &&
            r.sensor_name.toLowerCase().includes(lower),
        );
        return found?.value ?? "N/A";
      };

      const toNumericOrNA = (v: unknown) => {
        if (typeof v === "number" && !Number.isNaN(v)) return v;
        if (typeof v === "string") {
          const trimmed = v.trim();
          if (trimmed && !Number.isNaN(Number(trimmed))) {
            return Number(trimmed);
          }
        }
        return "N/A" as const;
      };

      async function fetchWeatherStemStation(site: WeatherStemSite) {
        try {
          const resWs = await fetch(site.url);
          if (!resWs.ok) {
            throw new Error("WeatherStem fetch failed");
          }
          const json = (await resWs.json()) as any;
          const records: any[] = json.records || [];

          const temp = extractSensorValue(records, "Thermometer");
          const dew = extractSensorValue(records, "Dewpoint");
          const wind = extractSensorValue(records, "Anemometer");
          const windVane = extractSensorValue(records, "Wind Vane");

          return {
            id: site.id,
            lat: site.lat,
            lon: site.lon,
            temp: toNumericOrNA(temp),
            dewpoint: toNumericOrNA(dew),
            windSpeed: toNumericOrNA(wind),
            windDir: toNumericOrNA(windVane),
          };
        } catch (err) {
          console.error(`WeatherStem station fetch error for ${site.id}:`, err);
          return {
            id: site.id,
            lat: site.lat,
            lon: site.lon,
            temp: "N/A" as const,
            dewpoint: "N/A" as const,
            windSpeed: "N/A" as const,
            windDir: "N/A" as const,
          };
        }
      }

      const mesonetPromise = Promise.all(
        stationCoords.map(([id, lat, lon]) =>
          fetchMesonetStation(id, lat, lon),
        ),
      );
      const weatherStemPromise = Promise.all(
        weatherStemSites.map((site) => fetchWeatherStemStation(site)),
      );

      const [mesonetStations, weatherStemStations] = await Promise.all([
        mesonetPromise,
        weatherStemPromise,
      ]);

      res.json([...mesonetStations, ...weatherStemStations]);
    } catch (error) {
      console.error("KY Stations fetch error:", error);
      res.status(500).json({ message: "Failed to fetch KY stations" });
    }
  });

  app.get("/api/ky-counties", async (_req: any, res: any) => {
    try {
      const url = "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/1/query?where=STATE%3D%2721%27&outFields=NAME&outSR=4326&f=geojson";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Census county fetch failed");
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("KY counties fetch error:", error);
      res.status(500).json({ message: "Failed to fetch KY counties" });
    }
  });

  return httpServer;
}
