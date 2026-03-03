import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, ScaleControl, GeoJSON } from "react-leaflet";
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
  satelliteBand = 'east-ir-10.3um'
}: MapAreaProps) {
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

        {/* Dark Matter Base Map - Excellent for GIS/Dashboards */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* GOES Satellite Layer (IEM) */}
        {showSatellite && (
          <TileLayer
            attribution='Satellite &copy; <a href="https://mesonet.agron.iastate.edu">IEM</a>'
            url={`https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/goes-${satelliteBand || 'east-ir-10.3um'}/{z}/{x}/{y}.png`}
            opacity={satelliteOpacity}
            maxZoom={19}
          />
        )}

        {/* Live Weather Radar Overlay (Iowa State Mesonet NEXRAD) */}
        {showRadar && (
          <TileLayer
            attribution='Weather data &copy; <a href="https://mesonet.agron.iastate.edu">IEM</a>'
            url="https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png"
            opacity={radarOpacity}
            maxZoom={19}
          />
        )}

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

        {/* WKU Pin */}
        <Marker position={[36.9850, -86.4550]}>
          <Popup className="font-sans text-xs">
            <div className="font-bold mb-1">WKU Campus</div>
            <div className="text-muted-foreground">Bowling Green, KY</div>
          </Popup>
        </Marker>
      </MapContainer>

      {/* Decorative GIS Overlay Elements */}
      <div className="absolute top-4 left-4 pointer-events-none select-none z-[400] flex flex-col gap-1">
        <div className="bg-card/80 backdrop-blur px-3 py-1 rounded border border-border/50 shadow-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary))]"></div>
          <span className="text-xs font-mono-tech font-bold tracking-widest text-primary">LIVE RADAR LINK ACTIVE</span>
        </div>
      </div>
    </div>
  );
}
