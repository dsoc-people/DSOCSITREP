import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, ScaleControl } from "react-leaflet";
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
  radarOpacity?: number;
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

export function MapArea({ center, zoom = 4, showDay1, showDay2, showDay3, showTornado, radarOpacity = 0.65 }: MapAreaProps) {
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

        {/* Live Weather Radar Overlay (Iowa State Mesonet NEXRAD) */}
        <TileLayer
          attribution='Weather data &copy; <a href="https://mesonet.agron.iastate.edu">IEM</a>'
          url="https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png"
          opacity={radarOpacity}
          maxZoom={19}
        />

        {/* SPC Day 1 Convective Outlook */}
        {showDay1 && (
          <TileLayer
            url="https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/spc-cat-day1/{z}/{x}/{y}.png"
            opacity={0.5}
            maxZoom={19}
          />
        )}

        {/* SPC Day 2 Convective Outlook */}
        {showDay2 && (
          <TileLayer
            url="https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/spc-cat-day2/{z}/{x}/{y}.png"
            opacity={0.5}
            maxZoom={19}
          />
        )}

        {/* SPC Day 3 Convective Outlook */}
        {showDay3 && (
          <TileLayer
            url="https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/spc-cat-day3/{z}/{x}/{y}.png"
            opacity={0.5}
            maxZoom={19}
          />
        )}

        {/* SPC Tornado Probabilities */}
        {showTornado && (
          <TileLayer
            url="https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/spc-torn-day1/{z}/{x}/{y}.png"
            opacity={0.5}
            maxZoom={19}
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
