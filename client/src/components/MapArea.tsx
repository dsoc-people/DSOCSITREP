import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import kyCountiesGeoJson from "../../public/ky-counties.json";
import { MapContainer, TileLayer, Marker, useMap, ZoomControl, ScaleControl, GeoJSON } from "react-leaflet";
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
      return "#55BB55"; // SPC general thunder green
    case "MRGL":
    case "MARGINAL":
      return "#00FF00"; // bright green
    case "SLGT":
    case "SLIGHT":
      return "#FFFF00"; // yellow
    case "ENH":
    case "ENHANCED":
      return "#FFA500"; // orange
    case "MDT":
    case "MODERATE":
      return "#FF0000"; // red
    case "HIGH":
      return "#FF00FF"; // magenta
    default:
      return "#FFFFFF"; // fallback white
  }
}

function getSpcTornadoColor(label: string | undefined | null) {
  const key = (label || "").replace("%", "");
  switch (key) {
    case "2":
      return "#99FF99"; // light green
    case "5":
      return "#00FF00"; // green
    case "10":
      return "#FFFF00"; // yellow
    case "15":
      return "#FFA500"; // orange
    case "30":
      return "#FF0000"; // red
    case "45":
      return "#FF00FF"; // magenta
    case "60":
      return "#FF0000"; // intense red for very high probs
    default:
      return "#FFFFFF";
  }
}

// Injects NWS-color diagonal hatch patterns into Leaflet's SVG overlay layer
// so GeoJSON fills can reference them via url(#id)
function AlertPatternDefs() {
  const map = useMap();

  useEffect(() => {
    const inject = () => {
      const pane = map.getPane('overlayPane');
      if (!pane) return;
      const svg = pane.querySelector('svg');
      if (!svg || svg.querySelector('#nws-warn-hatch')) return;

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = `
        <pattern id="nws-warn-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#FF0000" fill-opacity="0.2"/>
          <line x1="0" y1="0" x2="0" y2="8" stroke="#FF0000" stroke-width="3"/>
        </pattern>
        <pattern id="nws-watch-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#FFFF00" fill-opacity="0.12"/>
          <line x1="0" y1="0" x2="0" y2="8" stroke="#FFFF00" stroke-width="3"/>
        </pattern>
        <pattern id="nws-adv-hatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#00AAFF" fill-opacity="0.12"/>
          <line x1="0" y1="0" x2="0" y2="8" stroke="#00AAFF" stroke-width="3"/>
        </pattern>
      `;
      svg.insertBefore(defs, svg.firstChild);
    };

    inject();
    map.on('layeradd', inject);
    return () => { map.off('layeradd', inject); };
  }, [map]);

  return null;
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

  // Memoize icon by station.id only — prevents Leaflet from replacing the
  // DOM element (and wiping React content) on every parent re-render
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

  // Re-render the plot when live data updates without removing the marker
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

  // Simplified WBGT approximation (no solar radiation or pressure available)
  // Wet bulb ≈ average of temp and dewpoint (same as Python's dbdp2wb)
  // WBGT ≈ 0.7 * Twb + 0.3 * Tdb (globe term omitted without SRAD)
  const getWbgtColor = (tempF: number | "N/A", dpF: number | "N/A"): string => {
    if (tempF === "N/A" || dpF === "N/A") return "#ffffff";
    const wetBulbF = ((tempF as number) + (dpF as number)) / 2;
    const wbgtF = 0.7 * wetBulbF + 0.3 * (tempF as number);
    if (wbgtF < 66) return "#008000"; // Green
    if (wbgtF < 74) return "#FEF200"; // Yellow
    if (wbgtF < 83) return "#FF0000"; // Red
    return "#000000";                 // Black
  };

  const cx = 30, cy = 30;
  const staffLen = 22;
  const windDirDeg = typeof station.windDir === 'number' ? station.windDir : null;
  const windSpeedVal = typeof station.windSpeed === 'number' ? station.windSpeed : 0;
  const barbColor = getWbgtColor(station.temp, station.dewpoint);

  // Staff points in the direction wind comes FROM (met convention)
  // SVG angle = (windDir - 90) degrees from east, clockwise
  let staffEndX = cx;
  let staffEndY = cy - staffLen; // default calm: point north

  if (windDirDeg !== null) {
    const rad = (windDirDeg - 90) * Math.PI / 180;
    staffEndX = cx + staffLen * Math.cos(rad);
    staffEndY = cy + staffLen * Math.sin(rad);
  }

  // Build wind barb feathers along the staff
  // Encoding: pennant = 50 mph, long barb = 10 mph, short barb = 5 mph
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
          {/* White glow so black-category barbs are visible on dark map */}
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.2" floodColor="white" floodOpacity="0.9" />
          </filter>
        </defs>

        {/* Wind staff + barbs, colored by WBGT category */}
        <g filter={`url(#${filterId})`}>
          {windDirDeg !== null && windSpeedVal >= 3 && (
            <line x1={cx} y1={cy} x2={staffEndX.toFixed(1)} y2={staffEndY.toFixed(1)}
              stroke={barbColor} strokeWidth="1.5" />
          )}
          {barbElems}
        </g>

        {/* Station circle (calm = two concentric circles) */}
        {(windDirDeg === null || windSpeedVal < 3) && (
          <circle cx={cx} cy={cy} r={7} fill="none" stroke="white" strokeWidth="1" />
        )}
        <circle cx={cx} cy={cy} r={4} fill="black" stroke="white" strokeWidth="1.5" />
      </svg>

      {/* Temperature (upper left, close to station circle) */}
      <div style={{
        position: 'absolute', top: 14, left: 2,
        fontSize: '10px', fontWeight: 'bold', fontFamily: 'monospace',
        color: tempColor, lineHeight: 1, textShadow: shadow,
      }}>
        {tempDisplay}
      </div>

      {/* Dewpoint (lower left, close to station circle) */}
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

function getAlertColor(category: string) {
  if (category === 'warning') return '#FF0000';
  if (category === 'watch') return '#FFA500';
  return '#00AAFF'; // advisory
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
  alertFeatures = [],
}: MapAreaProps) {
  // Bust tile cache every 2 minutes for radar, 10 minutes for satellite
  const [radarTs, setRadarTs] = useState(() => Math.floor(Date.now() / 120000));
  const [satTs, setSatTs]     = useState(() => Math.floor(Date.now() / 600000));
  // Countdown display (seconds until next refresh)
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

  return (
    <div className="relative w-full h-full bg-background z-0">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        style={{ height: '100%', width: '100%', zIndex: 0 }}
        zoomControl={false}
      >
        <MapController center={center} zoom={zoom} />

        {/* Dark base map WITHOUT labels (labels rendered on top separately) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* GOES-East CONUS Satellite Layer (IEM) — refreshes every 10 min */}
        {showSatellite && (
          <TileLayer
            key={`sat-${satTs}`}
            attribution='Satellite &copy; <a href="https://mesonet.agron.iastate.edu">IEM</a>'
            url={`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes_east_conus_${satelliteBand || 'ch14'}/{z}/{x}/{y}.png`}
            opacity={satelliteOpacity}
            maxZoom={19}
          />
        )}

        {/* Live Weather Radar Overlay (Iowa State Mesonet NEXRAD) — refreshes every 2 min */}
        {showRadar && (
          <TileLayer
            key={`radar-${radarTs}`}
            attribution='Weather data &copy; <a href="https://mesonet.agron.iastate.edu">IEM</a>'
            url="https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png"
            opacity={radarOpacity}
            maxZoom={19}
          />
        )}

        {/* Kentucky county boundaries — always visible above radar/satellite */}
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

        {/* City/road labels rendered above radar & satellite */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          maxZoom={19}
          zIndex={400}
        />

        {/* SPC Day 1 Convective Outlook (GeoJSON from SPC) */}
        {showDay1 && day1Outlook && (
          <GeoJSON
            data={day1Outlook}
            style={(feature) => {
              const props = (feature?.properties as any) || {};
              const label =
                props.LABEL2 ??
                props.LABEL ??
                props.category;
              const baseColor = getSpcCategoryColor(label);
              const stroke = props.stroke || baseColor;
              const fill = props.fill || baseColor;
              return {
                color: stroke,
                weight: 2,
                fillColor: fill,
                fillOpacity: 0.25,
              };
            }}
          />
        )}

        {/* SPC Day 2 Convective Outlook */}
        {showDay2 && day2Outlook && (
          <GeoJSON
            data={day2Outlook}
            style={(feature) => {
              const props = (feature?.properties as any) || {};
              const label =
                props.LABEL2 ??
                props.LABEL ??
                props.category;
              const baseColor = getSpcCategoryColor(label);
              const stroke = props.stroke || baseColor;
              const fill = props.fill || baseColor;
              return {
                color: stroke,
                weight: 2,
                fillColor: fill,
                fillOpacity: 0.25,
              };
            }}
          />
        )}

        {/* SPC Day 3 Convective Outlook */}
        {showDay3 && day3Outlook && (
          <GeoJSON
            data={day3Outlook}
            style={(feature) => {
              const props = (feature?.properties as any) || {};
              const label =
                props.LABEL2 ??
                props.LABEL ??
                props.category;
              const baseColor = getSpcCategoryColor(label);
              const stroke = props.stroke || baseColor;
              const fill = props.fill || baseColor;
              return {
                color: stroke,
                weight: 2,
                fillColor: fill,
                fillOpacity: 0.25,
              };
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
              return {
                color,
                weight: 2,
                fillOpacity: 0.3,
              };
            }}
          />
        )}

        <ZoomControl position="topright" />
        <ScaleControl position="bottomright" imperial={true} metric={false} />

        {/* Inject NWS hatch pattern defs into Leaflet's SVG layer */}
        <AlertPatternDefs />

        {/* NWS Alert County Polygons — hatched by category (warning=red, watch=yellow, advisory=blue) */}
        {alertFeatures && alertFeatures.length > 0 && (
          <GeoJSON
            key={`alerts-${alertFeatures.map((f: any) => f.properties?.event).join(',')}`}
            data={{ type: 'FeatureCollection', features: alertFeatures } as any}
            style={(feature: any) => {
              const cat = feature?.properties?.category;
              const stroke = getAlertColor(cat);
              const patId = cat === 'warning' ? 'nws-warn-hatch' : cat === 'watch' ? 'nws-watch-hatch' : 'nws-adv-hatch';
              return { color: stroke, weight: 2, fillColor: `url(#${patId})`, fillOpacity: 1 };
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
                {String(Math.floor(radarCountdown / 60)).padStart(2,'0')}:{String(radarCountdown % 60).padStart(2,'0')}
              </span>
            </span>
          </div>
        )}
        {showSatellite && (
          <div className="bg-card/80 backdrop-blur px-3 py-1 rounded border border-border/50 shadow-lg flex items-center gap-2">
            <span className="text-[10px] font-mono-tech text-muted-foreground uppercase tracking-widest">
              SAT REFRESH IN <span className="text-primary font-bold">
                {String(Math.floor(satCountdown / 60)).padStart(2,'0')}:{String(satCountdown % 60).padStart(2,'0')}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
