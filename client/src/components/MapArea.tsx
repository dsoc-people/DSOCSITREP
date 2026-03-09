import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import kyCountiesGeoJson from "../../public/ky-counties.json";
import { MapContainer, TileLayer, WMSTileLayer, Marker, CircleMarker, useMap, ZoomControl, ScaleControl, GeoJSON } from "react-leaflet";
import L from "leaflet";

// Fix Leaflet's default icon path issues in React
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface StationData {
  id: string;
  lat: number;
  lon: number;
  temp: number | "N/A";
  dewpoint: number | "N/A";
  windSpeed: number | "N/A";
  windDir: number | "N/A";
}

interface MapAreaProps {
  center: [number, number];
  zoom?: number;
  showDay1?: boolean;
  showDay2?: boolean;
  showDay3?: boolean;
  showTornado?: boolean;
  showRadar?: boolean;
  radarOpacity?: number;
  showSatellite?: boolean;
  satelliteOpacity?: number;
  satelliteBand?: string;
  stations?: StationData[];
  alertFeatures?: any[];
  showNwsAlerts?: boolean;
  showSpcWatches?: boolean;
  showSurfaceAnalysis?: boolean;
  surfaceAnalysisOpacity?: number;
  showUpperAir?: boolean;
  upperAirOpacity?: number;
  showLightning?: boolean;
  showMcd?: boolean;
}

function useSpcGeoJson(show: boolean | undefined, url: string) {
  const [data, setData] = useState<any | null>(null);

  useEffect(() => {
    if (!show) return;

    let cancelled = false;

    fetch(url)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`SPC GeoJSON fetch failed: ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) {
          setData(json);
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("Error loading SPC GeoJSON", url, err);
      });

    return () => {
      cancelled = true;
    };
  }, [show, url]);

  return data;
}

function getSpcCategoryColor(label: string | undefined | null) {
  const key = (label || "").toUpperCase();
  switch (key) {
    case "TSTM":
    case "GENERAL THUNDERSTORMS":
    case "GENERAL THUNDERSTORMS RISK":
      return "#55BB55";
    case "MRGL":
    case "MARGINAL":
      return "#00FF00";
    case "SLGT":
    case "SLIGHT":
      return "#FFFF00";
    case "ENH":
    case "ENHANCED":
      return "#FFA500";
    case "MDT":
    case "MODERATE":
      return "#FF0000";
    case "HIGH":
      return "#FF00FF";
    default:
      return "#FFFFFF";
  }
}

function getSpcTornadoColor(label: string | undefined | null) {
  const key = (label || "").replace("%", "");
  switch (key) {
    case "2":   return "#99FF99";
    case "5":   return "#00FF00";
    case "10":  return "#FFFF00";
    case "15":  return "#FFA500";
    case "30":  return "#FF0000";
    case "45":  return "#FF00FF";
    case "60":  return "#FF0000";
    default:    return "#FFFFFF";
  }
}

/**
 * Official NWS product colors based on the NWS Operations Manual / VTEC color table.
 * Returns { color: strokeColor, fillOpacity: number }
 */
function getNwsAlertStyle(eventName: string, category: string): { color: string; fillOpacity: number } {
  const e = (eventName || "").toLowerCase();

  // --- Tornado ---
  if (e.includes("tornado warning"))                return { color: "#FF0000", fillOpacity: 0.4 };
  if (e.includes("tornado watch"))                  return { color: "#FFFF00", fillOpacity: 0.25 };

  // --- Severe Thunderstorm ---
  if (e.includes("severe thunderstorm warning"))    return { color: "#FFA500", fillOpacity: 0.4 };
  if (e.includes("severe thunderstorm watch"))      return { color: "#DB7093", fillOpacity: 0.25 };

  // --- Flash Flood ---
  if (e.includes("flash flood emergency"))          return { color: "#FF00FF", fillOpacity: 0.5 };
  if (e.includes("flash flood warning"))            return { color: "#8B0000", fillOpacity: 0.4 };
  if (e.includes("flash flood watch"))              return { color: "#2E8B57", fillOpacity: 0.25 };
  if (e.includes("flash flood statement"))          return { color: "#00FF00", fillOpacity: 0.15 };

  // --- Flood ---
  if (e.includes("flood warning"))                  return { color: "#00FF00", fillOpacity: 0.4 };
  if (e.includes("flood advisory"))                 return { color: "#00FF7F", fillOpacity: 0.25 };
  if (e.includes("flood watch"))                    return { color: "#2E8B57", fillOpacity: 0.25 };
  if (e.includes("flood statement"))                return { color: "#00FF7F", fillOpacity: 0.15 };

  // --- Winter / Ice / Snow ---
  if (e.includes("blizzard warning"))               return { color: "#FF4500", fillOpacity: 0.4 };
  if (e.includes("ice storm warning"))              return { color: "#8B008B", fillOpacity: 0.4 };
  if (e.includes("winter storm warning"))           return { color: "#FF69B4", fillOpacity: 0.4 };
  if (e.includes("winter storm watch"))             return { color: "#4169E1", fillOpacity: 0.25 };
  if (e.includes("winter storm advisory"))          return { color: "#6495ED", fillOpacity: 0.3 };
  if (e.includes("winter weather advisory"))        return { color: "#7B68EE", fillOpacity: 0.3 };
  if (e.includes("freezing rain advisory"))         return { color: "#DA70D6", fillOpacity: 0.3 };
  if (e.includes("freezing drizzle advisory"))      return { color: "#DA70D6", fillOpacity: 0.3 };
  if (e.includes("lake effect snow warning"))       return { color: "#008B8B", fillOpacity: 0.4 };
  if (e.includes("lake effect snow watch"))         return { color: "#87CEFA", fillOpacity: 0.25 };
  if (e.includes("lake effect snow advisory"))      return { color: "#48D1CC", fillOpacity: 0.3 };
  if (e.includes("heavy snow warning"))             return { color: "#FF69B4", fillOpacity: 0.4 };
  if (e.includes("snow squall warning"))            return { color: "#C71585", fillOpacity: 0.4 };
  if (e.includes("snow advisory"))                  return { color: "#6495ED", fillOpacity: 0.3 };
  if (e.includes("blowing snow advisory"))          return { color: "#6495ED", fillOpacity: 0.3 };
  if (e.includes("hard freeze warning"))            return { color: "#9400D3", fillOpacity: 0.4 };
  if (e.includes("hard freeze watch"))              return { color: "#4169E1", fillOpacity: 0.25 };
  if (e.includes("freeze warning"))                 return { color: "#483D8B", fillOpacity: 0.4 };
  if (e.includes("freeze watch"))                   return { color: "#00CED1", fillOpacity: 0.25 };
  if (e.includes("frost advisory"))                 return { color: "#6495ED", fillOpacity: 0.3 };

  // --- Wind ---
  if (e.includes("extreme wind warning"))           return { color: "#FF8C00", fillOpacity: 0.4 };
  if (e.includes("high wind warning"))              return { color: "#DAA520", fillOpacity: 0.4 };
  if (e.includes("high wind watch"))                return { color: "#B8860B", fillOpacity: 0.25 };
  if (e.includes("wind advisory"))                  return { color: "#D2B48C", fillOpacity: 0.3 };

  // --- Heat ---
  if (e.includes("excessive heat warning"))         return { color: "#C71585", fillOpacity: 0.4 };
  if (e.includes("excessive heat watch"))           return { color: "#800000", fillOpacity: 0.25 };
  if (e.includes("heat advisory"))                  return { color: "#FF7F50", fillOpacity: 0.3 };

  // --- Fire ---
  if (e.includes("red flag warning"))               return { color: "#FF1493", fillOpacity: 0.4 };
  if (e.includes("fire weather watch"))             return { color: "#FFDEAD", fillOpacity: 0.25 };

  // --- Dense Fog / Smoke ---
  if (e.includes("dense fog advisory"))             return { color: "#708090", fillOpacity: 0.3 };
  if (e.includes("dense smoke advisory"))           return { color: "#F4A460", fillOpacity: 0.3 };

  // --- Tropical ---
  if (e.includes("hurricane warning"))              return { color: "#DC143C", fillOpacity: 0.4 };
  if (e.includes("hurricane watch"))                return { color: "#FF00FF", fillOpacity: 0.25 };
  if (e.includes("storm surge warning"))            return { color: "#B524F7", fillOpacity: 0.4 };
  if (e.includes("storm surge watch"))              return { color: "#DB7FF7", fillOpacity: 0.25 };
  if (e.includes("tropical storm warning"))         return { color: "#B22222", fillOpacity: 0.4 };
  if (e.includes("tropical storm watch"))           return { color: "#F08080", fillOpacity: 0.25 };

  // --- Coastal / Marine ---
  if (e.includes("coastal flood warning"))          return { color: "#228B22", fillOpacity: 0.4 };
  if (e.includes("coastal flood watch"))            return { color: "#66CDAA", fillOpacity: 0.25 };
  if (e.includes("coastal flood advisory"))         return { color: "#7CFC00", fillOpacity: 0.3 };
  if (e.includes("high surf warning"))              return { color: "#228B22", fillOpacity: 0.4 };
  if (e.includes("high surf advisory"))             return { color: "#BA55D3", fillOpacity: 0.3 };
  if (e.includes("rip current statement"))          return { color: "#40E0D0", fillOpacity: 0.2 };

  // --- Air Quality ---
  if (e.includes("air quality alert"))              return { color: "#808080", fillOpacity: 0.3 };

  // --- Special / Misc ---
  if (e.includes("special weather statement"))      return { color: "#FFE4B5", fillOpacity: 0.2 };
  if (e.includes("hazardous weather outlook"))      return { color: "#EEE8AA", fillOpacity: 0.15 };
  if (e.includes("severe weather statement"))       return { color: "#00FFFF", fillOpacity: 0.2 };

  // --- Category fallbacks ---
  if (category === "warning")   return { color: "#FF0000", fillOpacity: 0.35 };
  if (category === "watch")     return { color: "#FFFF00", fillOpacity: 0.25 };
  return                               { color: "#00AAFF", fillOpacity: 0.2 };
}

// Component to handle imperative map flyTo when center prop changes
function MapController({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.5,
      easeLinearity: 0.25
    });
  }, [center, zoom, map]);

  return null;
}

import { DivIcon } from "leaflet";

function StationMarker({ station }: { station: StationData }) {
  const rootRef = useRef<any>(null);

  const icon = useMemo(() => new DivIcon({
    className: "station-div-icon",
    html: `<div id="station-${station.id}" style="width:60px;height:60px;"></div>`,
    iconSize: [60, 60] as [number, number],
    iconAnchor: [30, 30] as [number, number],
  }), [station.id]);

  const handleAdd = useCallback(() => {
    const el = document.getElementById(`station-${station.id}`);
    if (!el) return;
    import('react-dom/client').then(({ createRoot }) => {
      if (!rootRef.current) rootRef.current = createRoot(el);
      rootRef.current.render(<StationPlot station={station} />);
    });
  }, [station]);

  useEffect(() => {
    if (rootRef.current) {
      rootRef.current.render(<StationPlot station={station} />);
    }
  }, [station]);

  return (
    <Marker
      position={[station.lat, station.lon]}
      zIndexOffset={2000}
      icon={icon}
      eventHandlers={{ add: handleAdd }}
    />
  );
}

function StationPlot({ station }: { station: StationData }) {
  const getTempColor = (t: number | "N/A") => {
    if (t === "N/A") return "#ffffff";
    if (t < 32) return "#00ffff";
    if (t < 50) return "#00ff00";
    if (t < 70) return "#ffff00";
    if (t < 90) return "#ffa500";
    return "#ff0000";
  };

  const getWbgtColor = (tempF: number | "N/A", dpF: number | "N/A"): string => {
    if (tempF === "N/A" || dpF === "N/A") return "#ffffff";
    const wetBulbF = ((tempF as number) + (dpF as number)) / 2;
    const wbgtF = 0.7 * wetBulbF + 0.3 * (tempF as number);
    if (wbgtF < 66) return "#008000";
    if (wbgtF < 74) return "#FEF200";
    if (wbgtF < 83) return "#FF0000";
    return "#000000";
  };

  const cx = 30, cy = 30;
  const staffLen = 22;
  const windDirDeg = typeof station.windDir === 'number' ? station.windDir : null;
  const windSpeedVal = typeof station.windSpeed === 'number' ? station.windSpeed : 0;
  const barbColor = getWbgtColor(station.temp, station.dewpoint);

  let staffEndX = cx;
  let staffEndY = cy - staffLen;

  if (windDirDeg !== null) {
    const rad = (windDirDeg - 90) * Math.PI / 180;
    staffEndX = cx + staffLen * Math.cos(rad);
    staffEndY = cy + staffLen * Math.sin(rad);
  }

  const barbElems: any[] = [];

  if (windDirDeg !== null && windSpeedVal >= 3) {
    const rad = (windDirDeg - 90) * Math.PI / 180;
    const sDx = Math.cos(rad);
    const sDy = Math.sin(rad);
    const bLen = 10;
    const bDx = sDy * bLen;
    const bDy = -sDx * bLen;

    let spd = windSpeedVal;
    const pennants = Math.floor(spd / 50); spd -= pennants * 50;
    const longs = Math.floor(spd / 10); spd -= longs * 10;
    const shorts = spd >= 5 ? 1 : 0;

    let offset = 0;

    for (let i = 0; i < pennants; i++) {
      const tx = staffEndX - sDx * offset;
      const ty = staffEndY - sDy * offset;
      const bx = tx - sDx * 8;
      const by = ty - sDy * 8;
      barbElems.push(
        <polygon key={`p${i}`}
          points={`${tx.toFixed(1)},${ty.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)} ${(bx + bDx).toFixed(1)},${(by + bDy).toFixed(1)}`}
          fill={barbColor} stroke={barbColor} strokeWidth="0.5" />
      );
      offset += 10;
    }

    for (let i = 0; i < longs; i++) {
      const px = staffEndX - sDx * offset;
      const py = staffEndY - sDy * offset;
      barbElems.push(
        <line key={`l${i}`}
          x1={px.toFixed(1)} y1={py.toFixed(1)}
          x2={(px + bDx).toFixed(1)} y2={(py + bDy).toFixed(1)}
          stroke={barbColor} strokeWidth="1.5" />
      );
      offset += 5;
    }

    for (let i = 0; i < shorts; i++) {
      const px = staffEndX - sDx * offset;
      const py = staffEndY - sDy * offset;
      barbElems.push(
        <line key={`s${i}`}
          x1={px.toFixed(1)} y1={py.toFixed(1)}
          x2={(px + bDx / 2).toFixed(1)} y2={(py + bDy / 2).toFixed(1)}
          stroke={barbColor} strokeWidth="1.5" />
      );
    }
  }

  const tempColor = getTempColor(station.temp);
  const tempDisplay = station.temp !== "N/A" ? Math.round(station.temp as number) : "--";
  const dewDisplay = station.dewpoint !== "N/A" ? Math.round(station.dewpoint as number) : "--";
  const shadow = "1px 1px 2px #000, -1px -1px 2px #000, 0 0 3px #000";
  const filterId = `halo-${station.id}`;

  return (
    <div style={{ width: '60px', height: '60px', position: 'relative', pointerEvents: 'none' }}>
      <svg width="60" height="60" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="white" floodOpacity="0.9" />
          </filter>
        </defs>

        <g filter={`url(#${filterId})`}>
          {windDirDeg !== null && windSpeedVal >= 3 && (
            <line x1={cx} y1={cy} x2={staffEndX.toFixed(1)} y2={staffEndY.toFixed(1)}
              stroke={barbColor} strokeWidth="1.5" />
          )}
          {barbElems}
        </g>

        {(windDirDeg === null || windSpeedVal < 3) && (
          <circle cx={cx} cy={cy} r={7} fill="none" stroke="white" strokeWidth="1" />
        )}
        <circle cx={cx} cy={cy} r={4} fill="black" stroke="white" strokeWidth="1.5" />
      </svg>

      <div style={{
        position: 'absolute', top: 14, left: 2,
        fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace',
        color: tempColor, lineHeight: 1, textShadow: shadow,
      }}>
        {tempDisplay}
      </div>

      <div style={{
        position: 'absolute', bottom: 14, left: 2,
        fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace',
        color: '#00ff99', lineHeight: 1, textShadow: shadow,
      }}>
        {dewDisplay}
      </div>
    </div>
  );
}

interface LightningStrike {
  lat: number;
  lon: number;
  time: number; // ms since epoch
}

/**
 * Real-time lightning strikes via Blitzortung WebSocket.
 * Color-coded by age: white (<1 min) → yellow → orange → red-orange (>8 min).
 * Max 20-minute window, up to 1000 strikes in memory.
 */
function LightningLayer({ enabled }: { enabled: boolean }) {
  const [strikes, setStrikes] = useState<LightningStrike[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabled) {
      setStrikes([]);
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    const addStrike = (lat: number, lon: number) => {
      const now = Date.now();
      setStrikes((prev) => {
        const fresh = prev.filter((s) => now - s.time < 20 * 60 * 1000).slice(-999);
        return [...fresh, { lat, lon, time: now }];
      });
    };

    const tryConnect = (attempt: number = 1) => {
      const serverNum = ((attempt - 1) % 7) + 1; // cycle ws1–ws7
      const ws = new WebSocket(`wss://ws${serverNum}.blitzortung.org/`);
      wsRef.current = ws;

      ws.onopen = () => {
        // Subscribe to continental US bounding box
        ws.send(JSON.stringify({ west: -130, east: -60, north: 55, south: 20 }));
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string);
          // Standard Blitzortung format: top-level lat/lon fields
          if (typeof data.lat === "number" && typeof data.lon === "number") {
            addStrike(data.lat, data.lon);
          }
          // Array-of-strikes format used by some server versions
          if (Array.isArray(data.s)) {
            (data.s as number[][]).forEach((s) => {
              if (s.length >= 3) addStrike(s[1], s[2]);
            });
          }
        } catch (_) {/* ignore malformed frames */}
      };

      ws.onerror = () => { ws.close(); };

      ws.onclose = () => {
        if (enabledRef.current && wsRef.current === ws) {
          // Exponential back-off capped at 15 s, then try next server
          const delay = Math.min(2000 * attempt, 15000);
          setTimeout(() => { if (enabledRef.current) tryConnect(attempt + 1); }, delay);
        }
      };
    };

    tryConnect();

    // Prune old strikes every 30 s
    const prune = setInterval(() => {
      const cutoff = Date.now() - 20 * 60 * 1000;
      setStrikes((prev) => prev.filter((s) => s.time > cutoff));
    }, 30000);

    return () => {
      clearInterval(prune);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [enabled]);

  const now = Date.now();
  return (
    <>
      {strikes.map((strike, i) => {
        const age = now - strike.time;
        const maxAge = 20 * 60 * 1000;
        const opacity = Math.max(0.08, 1 - (age / maxAge) * 0.92);
        const color =
          age < 60_000      ? "#FFFFFF" :  // <1 min: white flash
          age < 3 * 60_000  ? "#FFFF00" :  // <3 min: yellow
          age < 8 * 60_000  ? "#FFA500" :  // <8 min: orange
                              "#FF4400";   // >8 min: red-orange fade
        const radius = age < 60_000 ? 5 : age < 3 * 60_000 ? 3 : 2;
        return (
          <CircleMarker
            key={`${strike.time}-${i}`}
            center={[strike.lat, strike.lon]}
            radius={radius}
            fillColor={color}
            color={color}
            weight={0.5}
            fillOpacity={opacity}
            opacity={opacity * 0.7}
          />
        );
      })}
    </>
  );
}

export function MapArea({
  center,
  zoom = 4,
  showDay1,
  showDay2,
  showDay3,
  showTornado,
  showRadar = true,
  radarOpacity = 0.65,
  showSatellite = false,
  satelliteOpacity = 0.5,
  satelliteBand = 'ch14',
  stations = [],
  showNwsAlerts = true,
  showSpcWatches = false,
  showSurfaceAnalysis = false,
  surfaceAnalysisOpacity = 0.8,
  showUpperAir = false,
  upperAirOpacity = 0.7,
  showLightning = false,
  showMcd = false,
}: MapAreaProps) {
  // Bust tile cache every 2 minutes for radar, 10 minutes for satellite
  const [radarTs, setRadarTs] = useState(() => Math.floor(Date.now() / 120000));
  const [satTs, setSatTs]     = useState(() => Math.floor(Date.now() / 600000));
  const [radarCountdown, setRadarCountdown] = useState(0);
  const [satCountdown,   setSatCountdown]   = useState(0);

  useEffect(() => {
    const tick = () => {
      const now = Date.now() / 1000;
      setRadarCountdown(Math.ceil(120 - (now % 120)));
      setSatCountdown(Math.ceil(600 - (now % 600)));
      setRadarTs(Math.floor(Date.now() / 120000));
      setSatTs(Math.floor(Date.now() / 600000));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  const day1Outlook = useSpcGeoJson(!!showDay1, "https://www.spc.noaa.gov/products/outlook/day1otlk_cat.nolyr.geojson");
  const day2Outlook = useSpcGeoJson(!!showDay2, "https://www.spc.noaa.gov/products/outlook/day2otlk_cat.nolyr.geojson");
  const day3Outlook = useSpcGeoJson(!!showDay3, "https://www.spc.noaa.gov/products/outlook/day3otlk_cat.nolyr.geojson");
  const day1Tornado = useSpcGeoJson(!!showTornado, "https://www.spc.noaa.gov/products/outlook/day1otlk_torn.nolyr.geojson");
  // SPC active watch boxes — proxied through server to avoid CORS
  const spcWatchData = useSpcGeoJson(!!showSpcWatches, "/api/weather/watches");
  // SPC active Mesoscale Discussions — proxied through server for CORS reliability
  // Using the GeoJSON endpoint which is the standard programmatic equivalent of the KMZ
  const mcdData = useSpcGeoJson(!!showMcd, "/api/weather/mcd");
  // NOAA official WWA polygons from ArcGIS FeatureServer (national coverage, official geometries)
  const nwsWwaData = useSpcGeoJson(!!showNwsAlerts, "/api/weather/nws-wwa");

  return (
    <div className="relative w-full h-full bg-background z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <MapController center={center} zoom={zoom} />

        {/* Dark base map WITHOUT labels */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* GOES-East CONUS Satellite Layer */}
        {showSatellite && (
          <TileLayer
            key={`sat-${satTs}`}
            attribution='Satellite &copy; <a href="https://mesonet.agron.iastate.edu">IEM</a>'
            url={`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes_east_conus_${satelliteBand || 'ch14'}/{z}/{x}/{y}.png`}
            opacity={satelliteOpacity}
            maxZoom={19}
          />
        )}

        {/* Live Weather Radar Overlay */}
        {showRadar && (
          <TileLayer
            key={`radar-${radarTs}`}
            attribution='Weather data &copy; <a href="https://mesonet.agron.iastate.edu">IEM</a>'
            url="https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png"
            opacity={radarOpacity}
            maxZoom={19}
          />
        )}

        {/* NOAA nowcoast Surface Analysis (fronts, highs, lows) */}
        {showSurfaceAnalysis && (
          <WMSTileLayer
            url="https://nowcoast.noaa.gov/arcgis/services/meteorology/surface_analysis_fronts/MapServer/WmsServer"
            layers="0"
            format="image/png"
            transparent={true}
            version="1.3.0"
            opacity={surfaceAnalysisOpacity}
            attribution='Surface Analysis &copy; <a href="https://nowcoast.noaa.gov">NOAA nowCOAST</a>'
          />
        )}

        {/* NOAA nowcoast Upper Air Analysis (500mb heights, vorticity) */}
        {showUpperAir && (
          <WMSTileLayer
            url="https://nowcoast.noaa.gov/arcgis/services/meteorology/upper_air_analysis/MapServer/WmsServer"
            layers="0"
            format="image/png"
            transparent={true}
            version="1.3.0"
            opacity={upperAirOpacity}
            attribution='Upper Air Analysis &copy; <a href="https://nowcoast.noaa.gov">NOAA nowCOAST</a>'
          />
        )}

        {/* Kentucky county boundaries */}
        <GeoJSON
          key="ky-counties"
          data={kyCountiesGeoJson as any}
          style={() => ({
            color: "#ff3333",
            weight: 1.5,
            fill: false,
            opacity: 1,
          })}
        />

        {/* City/road labels on top */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          maxZoom={19}
          zIndex={400}
        />

        {/* SPC Day 1 Convective Outlook */}
        {showDay1 && day1Outlook && (
          <GeoJSON
            data={day1Outlook}
            style={(feature) => {
              const props = (feature?.properties as any) || {};
              const label = props.LABEL2 ?? props.LABEL ?? props.category;
              const baseColor = getSpcCategoryColor(label);
              return { color: props.stroke || baseColor, weight: 2, fillColor: props.fill || baseColor, fillOpacity: 0.25 };
            }}
          />
        )}

        {/* SPC Day 2 Convective Outlook */}
        {showDay2 && day2Outlook && (
          <GeoJSON
            data={day2Outlook}
            style={(feature) => {
              const props = (feature?.properties as any) || {};
              const label = props.LABEL2 ?? props.LABEL ?? props.category;
              const baseColor = getSpcCategoryColor(label);
              return { color: props.stroke || baseColor, weight: 2, fillColor: props.fill || baseColor, fillOpacity: 0.25 };
            }}
          />
        )}

        {/* SPC Day 3 Convective Outlook */}
        {showDay3 && day3Outlook && (
          <GeoJSON
            data={day3Outlook}
            style={(feature) => {
              const props = (feature?.properties as any) || {};
              const label = props.LABEL2 ?? props.LABEL ?? props.category;
              const baseColor = getSpcCategoryColor(label);
              return { color: props.stroke || baseColor, weight: 2, fillColor: props.fill || baseColor, fillOpacity: 0.25 };
            }}
          />
        )}

        {/* SPC Day 1 Tornado Probabilities */}
        {showTornado && day1Tornado && (
          <GeoJSON
            data={day1Tornado}
            style={(feature) => {
              const label =
                (feature?.properties as any)?.LABEL2 ??
                (feature?.properties as any)?.LABEL ??
                (feature?.properties as any)?.prob;
              const color = getSpcTornadoColor(label);
              return { color, weight: 2, fillOpacity: 0.3 };
            }}
          />
        )}

        {/* SPC Active Watch Boxes — actual polygon boundaries (Tornado=yellow, SVR TSTM=pink) */}
        {showSpcWatches && spcWatchData && (
          <GeoJSON
            key={`spc-watches-${JSON.stringify(spcWatchData)?.length}`}
            data={spcWatchData}
            style={(feature) => {
              const wtchTyp = ((feature?.properties as any)?.WTCH_TYP || "").toUpperCase();
              const color = wtchTyp === "TORNADO" ? "#FFFF00" : "#DB7093";
              return { color, weight: 2.5, fillColor: color, fillOpacity: 0.2, dashArray: "8 4" };
            }}
            onEachFeature={(feature, layer) => {
              const props = (feature.properties as any) || {};
              const label = props.WTCH_TYP === "TORNADO" ? "Tornado Watch" : "Severe Thunderstorm Watch";
              layer.bindTooltip(label, { sticky: true, className: "leaflet-tooltip-dark" });
            }}
          />
        )}

        {/* SPC Active Mesoscale Discussions — purple dashed outline */}
        {showMcd && mcdData && (
          <GeoJSON
            key={`mcd-${JSON.stringify(mcdData)?.length}`}
            data={mcdData}
            style={() => ({
              color: "#9B30FF",
              weight: 2,
              dashArray: "6 4",
              fillColor: "#9B30FF",
              fillOpacity: 0.1,
            })}
            onEachFeature={(feature, layer) => {
              const props = (feature.properties as any) || {};
              const label = `MCD #${props.PRODID || props.mdnum || "?"}`;
              layer.bindTooltip(label, { sticky: true, className: "leaflet-tooltip-dark" });
            }}
          />
        )}

        {/* Real-time lightning strikes (Blitzortung) */}
        <LightningLayer enabled={!!showLightning} />

        <ZoomControl position="topright" />
        <ScaleControl position="bottomright" imperial={true} metric={false} />

        {/* NWS Alert Polygons — national, no state filter.
            Both sources (NWS API direct polygons + NOAA FeatureServer county shapes)
            are normalised to { eventName, senderName, expires } by the server. */}
        {showNwsAlerts && nwsWwaData && (
          <GeoJSON
            key={`nws-wwa-${(nwsWwaData as any)?.features?.length ?? 0}`}
            data={nwsWwaData}
            style={(feature: any) => {
              const eventName = (feature?.properties?.eventName as string) || "";
              const { color, fillOpacity } = getNwsAlertStyle(eventName, "");
              return { color, weight: 2.5, fillColor: color, fillOpacity };
            }}
            onEachFeature={(feature, layer) => {
              const props = feature?.properties || {};
              const name = props.eventName || "";
              const who = props.senderName ? ` (${props.senderName})` : "";
              if (name) layer.bindTooltip(`${name}${who}`, { sticky: true, className: "leaflet-tooltip-dark" });
            }}
          />
        )}

        {/* KY Stations Weather Plots */}
        {stations && stations.length > 0 && stations.map((s) => (
          <StationMarker key={s.id} station={s} />
        ))}
      </MapContainer>

      {/* Status / refresh overlay */}
      <div className="absolute top-4 left-4 pointer-events-none select-none z-[400] flex flex-col gap-1">
        <div className="bg-card/80 backdrop-blur px-3 py-1 rounded border border-border/50 shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]"></div>
          <span className="text-xs font-mono-tech font-bold tracking-widest text-primary">LIVE RADAR LINK ACTIVE</span>
        </div>
        {showRadar && (
          <div className="bg-card/80 backdrop-blur px-3 py-1 rounded border border-border/50 shadow-lg flex items-center gap-2">
            <span className="text-[10px] font-mono-tech text-muted-foreground uppercase tracking-widest">
              RADAR REFRESH IN <span className="text-primary font-bold">
                {String(Math.floor(radarCountdown / 60)).padStart(2, '0')}:{String(radarCountdown % 60).padStart(2, '0')}
              </span>
            </span>
          </div>
        )}
        {showSatellite && (
          <div className="bg-card/80 backdrop-blur px-3 py-1 rounded border border-border/50 shadow-lg flex items-center gap-2">
            <span className="text-[10px] font-mono-tech text-muted-foreground uppercase tracking-widest">
              SAT REFRESH IN <span className="text-primary font-bold">
                {String(Math.floor(satCountdown / 60)).padStart(2, '0')}:{String(satCountdown % 60).padStart(2, '0')}
              </span>
            </span>
          </div>
        )}
        {showLightning && (
          <div className="bg-card/80 backdrop-blur px-3 py-1 rounded border border-border/50 shadow-lg flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_6px_#FFFF00]"></div>
            <span className="text-[10px] font-mono-tech text-yellow-400 uppercase tracking-widest font-bold">LIGHTNING LIVE</span>
          </div>
        )}
      </div>
    </div>
  );
}
