import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import h5wasm from "h5wasm/node";

// ── GOES GLM helpers ─────────────────────────────────────────────────────────
// J2000 epoch (2000-01-01T12:00:00Z) in Unix milliseconds
const J2000_UNIX_MS = 946728000_000;

interface GlmCache { features: any[]; timestamp: number; }
let glmCache: GlmCache | null = null;
const GLM_CACHE_TTL_MS = 25_000;

function getDayOfYear(d: Date): number {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((d.getTime() - start.getTime()) / 86_400_000);
}

function extractS3Keys(xml: string): string[] {
  return [...xml.matchAll(/<Key>([^<]+\.nc)<\/Key>/g)].map(m => m[1]);
}

async function listGlmFiles(year: number, doy: number, hour: number): Promise<string[]> {
  const prefix = `GLM-L2-LCFA/${year}/${String(doy).padStart(3,'0')}/${String(hour).padStart(2,'0')}/`;
  const url = `https://noaa-goes16.s3.amazonaws.com/?prefix=${prefix}&list-type=2&max-keys=300`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!resp.ok) return [];
  return extractS3Keys(await resp.text());
}
// ─────────────────────────────────────────────────────────────────────────────

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
      // No area filter = all active alerts nationally per NWS OpenAPI spec
      const response = await fetch(`https://api.weather.gov/alerts/active?status=actual`);

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
        const eventLower = props.event?.toLowerCase() || '';

        let category = 'advisory';
        if (eventLower.includes('warning')) category = 'warning';
        else if (eventLower.includes('watch')) category = 'watch';

        const alert = {
          id: props.id,
          event: props.event || 'Unknown',
          headline: props.headline || 'No headline',
          severity: props.severity || 'Unknown',
          urgency: props.urgency || 'Unknown',
          expires: props.expires || null
        };

        if (category === 'warning') warnings.push(alert);
        else if (category === 'watch') watches.push(alert);
        else advisories.push(alert);
      });

      res.json({ warnings, watches, advisories });
    } catch (error) {
      console.error('Weather alerts error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Latest NWS Area Forecast Discussion for Louisville/Nashville offices
  app.get("/api/weather/afd", async (req, res) => {
    try {
      const office = (req as any).query.office || 'LMK';
      const listRes = await fetch(`https://api.weather.gov/products/types/AFD/locations/${office}`);
      if (!listRes.ok) throw new Error(`AFD list fetch failed: ${listRes.status}`);
      const list = await listRes.json();
      const latest = list['@graph']?.[0];
      if (!latest?.['@id']) return res.json({ text: 'No AFD available.', issuanceTime: null, office });

      const textRes = await fetch(latest['@id']);
      if (!textRes.ok) throw new Error('AFD product fetch failed');
      const product = await textRes.json();

      res.json({
        text: product.productText || 'No text available.',
        issuanceTime: product.issuanceTime || null,
        office,
      });
    } catch (error) {
      console.error('AFD fetch error:', error);
      res.status(500).json({ message: 'Failed to fetch AFD' });
    }
  });

  // SPC Active Mesoscale Discussions — scraped from spc.noaa.gov (SAGUI method)
  // ActiveMD.geojson is unreliable; instead we scrape the MD listing page and
  // parse each MD's raw LAT...LON 8-char coordinate format directly.
  app.get("/api/weather/mcd", async (req, res) => {
    try {
      const headers = { "User-Agent": "DSOC-Dashboard/1.0 (dsoc@wku.edu)" };

      // 1. Fetch the active MD listing page
      const listResp = await fetch('https://www.spc.noaa.gov/products/md/', { headers });
      if (!listResp.ok) return res.json({ type: 'FeatureCollection', features: [] });
      const listHtml = await listResp.text();

      // Check if any MDs are active
      if (listHtml.includes('No Mesoscale Discussions are currently in effect')) {
        return res.json({ type: 'FeatureCollection', features: [] });
      }

      // Extract MD page links e.g. /products/md/md2026-0042.html
      const mdLinks = [...listHtml.matchAll(/href="(\/products\/md\/md[\d-]+\.html)"/g)]
        .map(m => m[1]);

      if (mdLinks.length === 0) return res.json({ type: 'FeatureCollection', features: [] });

      // 2. Fetch each MD page and parse coordinates + metadata
      const features: any[] = [];

      for (const link of mdLinks) {
        try {
          const mdResp = await fetch(`https://www.spc.noaa.gov${link}`, { headers });
          if (!mdResp.ok) continue;
          const mdHtml = await mdResp.text();

          // Extract MD number from URL
          const numMatch = link.match(/md[\d]+-(\d+)\.html/);
          const mdNumber = numMatch ? parseInt(numMatch[1], 10) : 0;

          // Strip HTML tags to get plain text
          const text = mdHtml.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/gi, ' ');
          const lines = text.split('\n').map(l => l.trim());

          // Parse "Concerning..." and "Probability of Watch Issuance..."
          let concern = '';
          let probWatch = '';
          for (const line of lines) {
            if (line.includes('Concerning...')) {
              concern = line.split('Concerning...')[1]
                .replace('Severe potential...', '').trim();
            }
            if (line.includes('Probability of Watch Issuance...')) {
              probWatch = line.split('Probability of Watch Issuance...')[1].trim();
            }
          }
          const label = probWatch ? `${concern} (${probWatch})` : concern;

          // Parse LAT...LON section — tokens are 8-char combined LLLLOOOO
          const latLonIdx = lines.findIndex(l => l.startsWith('LAT...LON'));
          if (latLonIdx === -1) continue;

          const tokens: string[] = [];
          for (let i = latLonIdx; i < lines.length; i++) {
            if (i > latLonIdx && lines[i] === '') break;
            const cleaned = lines[i].replace('LAT...LON', '').trim();
            tokens.push(...cleaned.split(/\s+/).filter(t => t.length === 8));
          }

          if (tokens.length < 3) continue;

          // Decode each 8-char token → [lon, lat]
          const coords: [number, number][] = [];
          for (const t of tokens) {
            const lat = parseFloat(t.slice(0, 2) + '.' + t.slice(2, 4));
            let lon: number;
            const d = t[4];
            if (d === '0' || d === '1' || d === '2') {
              lon = parseFloat('-1' + t.slice(4, 6) + '.' + t.slice(6, 8));
            } else {
              lon = parseFloat('-' + t.slice(4, 6) + '.' + t.slice(6, 8));
            }
            if (!isNaN(lat) && !isNaN(lon)) coords.push([lon, lat]);
          }

          if (coords.length < 3) continue;

          // Close the polygon
          if (coords[0][0] !== coords[coords.length - 1][0] ||
              coords[0][1] !== coords[coords.length - 1][1]) {
            coords.push(coords[0]);
          }

          features.push({
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [coords] },
            properties: {
              md_number: mdNumber,
              PRODID: mdNumber,
              mdnum: mdNumber,
              md_location: label,
              md_discussion: label,
            }
          });
        } catch (err) {
          console.warn('Failed to parse MD:', link, err);
        }
      }

      res.json({ type: 'FeatureCollection', features });
    } catch (error) {
      console.error('MCD fetch error:', error);
      res.json({ type: 'FeatureCollection', features: [] });
    }
  });

  // SPC Active Watch Boxes proxy (avoids CORS when served from browser)
  app.get("/api/weather/watches", async (_req: any, res: any) => {
    try {
      const response = await fetch('https://www.spc.noaa.gov/products/watch/ActiveWW.geojson', {
        headers: { "User-Agent": "KAIR-WKU/1.0 (dsoc@wku.edu)" }
      });
      if (!response.ok) return res.json({ type: 'FeatureCollection', features: [] });
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Watches fetch error:', error);
      res.json({ type: 'FeatureCollection', features: [] });
    }
  });

  // NWS active alert polygons — national, no state filter.
  // NWS API returns GeoJSON; features with geometry != null have direct polygon coordinates
  // (tornado warnings, severe thunderstorm warnings, flash flood warnings, etc.).
  // County/zone-based alerts (watches, advisories) are fetched from the NOAA FeatureServer
  // and merged so the map shows all active WWA nationwide.
  app.get("/api/weather/nws-wwa", async (_req: any, res: any) => {
    try {
      // Source 1: NWS API — features that carry their own polygon geometry
      const nwsRes = await fetch("https://api.weather.gov/alerts/active?status=actual", {
        headers: { "User-Agent": "KAIR-WKU/1.0 (dsoc@wku.edu)", "Accept": "application/geo+json" }
      });
      const nwsFeatures: any[] = [];
      if (nwsRes.ok) {
        const nwsData = await nwsRes.json();
        for (const f of (nwsData.features || [])) {
          if (f.geometry) {
            nwsFeatures.push({
              type: "Feature",
              geometry: f.geometry,
              properties: {
                eventName: f.properties?.event || "",
                senderName: f.properties?.senderName || "",
                expires: f.properties?.expires || null,
              }
            });
          }
        }
      }

      // Source 2: NOAA ArcGIS FeatureServer — county/zone polygon representations
      // prod_type field = full event name (e.g. "Tornado Watch", "Winter Storm Warning")
      let noaaFeatures: any[] = [];
      try {
        const noaaRes = await fetch(
          "https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
          { headers: { "User-Agent": "KAIR-WKU/1.0 (dsoc@wku.edu)" } }
        );
        if (noaaRes.ok) {
          const noaaData = await noaaRes.json();
          noaaFeatures = (noaaData.features || []).map((f: any) => ({
            type: "Feature",
            geometry: f.geometry,
            properties: {
              eventName: f.properties?.prod_type || f.properties?.phenom || "",
              senderName: f.properties?.wfo || "",
              expires: f.properties?.expiration || null,
            }
          }));
        }
      } catch { /* use only NWS features if NOAA FeatureServer is unavailable */ }

      res.json({
        type: "FeatureCollection",
        features: [...nwsFeatures, ...noaaFeatures]
      });
    } catch {
      res.json({ type: "FeatureCollection", features: [] });
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

  // GOES-16 GLM (Geostationary Lightning Mapper) via NOAA Open Data on AWS
  // Free — NOAA pays egress. Files update every ~20s. No AWS account required.
  app.get("/api/weather/lightning", async (req, res) => {
    try {
      // Serve from cache if still fresh
      if (glmCache && Date.now() - glmCache.timestamp < GLM_CACHE_TTL_MS) {
        return res.json({ type: 'FeatureCollection', features: glmCache.features });
      }

      const now = new Date();
      const year = now.getUTCFullYear();
      const doy  = getDayOfYear(now);
      const hour = now.getUTCHours();

      // List current hour; fall back to previous hour if empty (first minute of hour)
      let keys = await listGlmFiles(year, doy, hour);
      if (keys.length === 0) {
        const prevHour = hour === 0 ? 23 : hour - 1;
        const prevDoy  = hour === 0 ? doy - 1 : doy;
        keys = await listGlmFiles(year, prevDoy, prevHour);
      }

      // Latest 6 files ≈ 2 minutes of flash data
      const latest = keys.slice(-6);
      if (latest.length === 0) {
        return res.json({ type: 'FeatureCollection', features: [] });
      }

      const { FS } = await h5wasm.ready;
      const allFeatures: any[] = [];

      for (const key of latest) {
        let buffer: ArrayBuffer;
        try {
          const r = await fetch(`https://noaa-goes16.s3.amazonaws.com/${key}`, {
            signal: AbortSignal.timeout(10_000)
          });
          if (!r.ok) continue;
          buffer = await r.arrayBuffer();
        } catch { continue; }

        const tmpName = `glm_${Date.now()}_${Math.random().toString(36).slice(2)}.nc`;
        FS.writeFile(tmpName, new Uint8Array(buffer));

        try {
          const f = new h5wasm.File(tmpName, 'r');
          const flashLat  = f.get('flash_lat')?.value  as Float32Array | undefined;
          const flashLon  = f.get('flash_lon')?.value  as Float32Array | undefined;
          const flashTime = f.get('flash_time_offset_of_first_event')?.value as Float32Array | undefined;
          const ptVal     = f.get('product_time')?.value;
          f.close();

          if (flashLat && flashLon && flashLat.length > 0) {
            // product_time = seconds since J2000 epoch (2000-01-01T12:00:00Z)
            const baseMs = ptVal ? (Number(ptVal[0]) * 1000 + J2000_UNIX_MS) : Date.now();
            for (let i = 0; i < flashLat.length; i++) {
              allFeatures.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [flashLon[i], flashLat[i]] },
                properties: {
                  timestamp: new Date(baseMs + (flashTime ? flashTime[i] * 1000 : 0)).toISOString()
                }
              });
            }
          }
        } catch (err) {
          console.warn('GLM parse error:', key, err);
        } finally {
          try { FS.unlink(tmpName); } catch {}
        }
      }

      glmCache = { features: allFeatures, timestamp: Date.now() };
      res.json({ type: 'FeatureCollection', features: allFeatures });

    } catch (error) {
      console.error('GOES GLM fetch error:', error);
      res.json({ type: 'FeatureCollection', features: glmCache?.features ?? [] });
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

  // ── Allisonhouse ENTLN Lightning (.places parser) ────────────────────────
  function parseEntlnPlaces(text: string): any[] {
    const features: any[] = [];
    for (const raw of text.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith(';') || line.startsWith('//')) continue;

      // GRLevel2 placefile: Icon: lat, lon, angle, iconfile, label
      const iconMatch = line.match(/^Icon:\s*([-\d.]+)\s*,\s*([-\d.]+)/i);
      if (iconMatch) {
        const lat = parseFloat(iconMatch[1]);
        const lon = parseFloat(iconMatch[2]);
        if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { timestamp: new Date().toISOString() } });
        }
        continue;
      }

      // Tab-delimited: Lat\tLon\t...
      const tabParts = line.split('\t');
      if (tabParts.length >= 2) {
        const lat = parseFloat(tabParts[0]);
        const lon = parseFloat(tabParts[1]);
        if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { timestamp: new Date().toISOString() } });
          continue;
        }
      }

      // Comma-delimited: Lat,Lon[,...]
      const commaParts = line.split(',');
      if (commaParts.length >= 2) {
        const lat = parseFloat(commaParts[0]);
        const lon = parseFloat(commaParts[1]);
        if (!isNaN(lat) && !isNaN(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
          features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: { timestamp: new Date().toISOString() } });
        }
      }
    }
    return features;
  }

  // ── Allisonhouse MCD (.places polygon parser) ─────────────────────────────
  function parseMcdPlacesAh(text: string): any[] {
    const features: any[] = [];
    const lines = text.split('\n').map(l => l.trim());
    let inPolygon = false;
    let currentCoords: [number, number][] = [];
    let currentProps: any = {};

    for (const line of lines) {
      if (!line || line.startsWith(';') || line.startsWith('//')) continue;

      const titleMatch = line.match(/^Title:\s*(.+)$/i);
      if (titleMatch) { currentProps.title = titleMatch[1].trim(); continue; }

      if (/^Polygon:/i.test(line) || line.toLowerCase() === 'polygon') {
        inPolygon = true; currentCoords = []; continue;
      }

      if (/^End:/i.test(line) || line.toLowerCase() === 'end') {
        if (inPolygon && currentCoords.length >= 3) {
          const coords = [...currentCoords];
          if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
            coords.push(coords[0]);
          }
          features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { ...currentProps } });
          currentProps = {};
        }
        inPolygon = false; currentCoords = []; continue;
      }

      if (inPolygon) {
        const parts = line.split(',');
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lon = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lon)) currentCoords.push([lon, lat]);
        }
      }
    }
    return features;
  }

  app.get("/api/weather/entln", async (_req: any, res: any) => {
    try {
      const response = await fetch(
        "https://feeds.allisonhouse.com/ec12f074a76bc6f9301c02266382f73e/entln.places",
        { headers: { "User-Agent": "DSOC-Dashboard/1.0 (dsoc@wku.edu)" }, signal: AbortSignal.timeout(10_000) }
      );
      if (!response.ok) return res.json({ type: 'FeatureCollection', features: [] });
      const text = await response.text();
      res.json({ type: 'FeatureCollection', features: parseEntlnPlaces(text) });
    } catch (error) {
      console.error('ENTLN fetch error:', error);
      res.json({ type: 'FeatureCollection', features: [] });
    }
  });

  app.get("/api/weather/ah-mcd", async (_req: any, res: any) => {
    try {
      const response = await fetch(
        "https://feeds.allisonhouse.com/ec12f074a76bc6f9301c02266382f73e/mcd.places",
        { headers: { "User-Agent": "DSOC-Dashboard/1.0 (dsoc@wku.edu)" }, signal: AbortSignal.timeout(10_000) }
      );
      if (!response.ok) return res.json({ type: 'FeatureCollection', features: [] });
      const text = await response.text();
      res.json({ type: 'FeatureCollection', features: parseMcdPlacesAh(text) });
    } catch (error) {
      console.error('AH MCD fetch error:', error);
      res.json({ type: 'FeatureCollection', features: [] });
    }
  });
  // ─────────────────────────────────────────────────────────────────────────

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
