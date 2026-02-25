import { useEffect, useState } from "react";
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Layers } from "lucide-react";

// Fix for default Leaflet icons in React
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface WeatherMapProps {
  center: [number, number];
  zoom: number;
  locations?: Array<{ id: number; name: string; lat: string; lon: string }>;
}

// Component to handle programmatic map movements
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.5,
      easeLinearity: 0.25
    });
  }, [center, zoom, map]);
  return null;
}

export function WeatherMap({ center, zoom, locations = [] }: WeatherMapProps) {
  const [showRadar, setShowRadar] = useState(true);

  return (
    <div className="relative w-full h-full bg-background z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        <MapUpdater center={center} zoom={zoom} />
        
        {/* Dark theme base map (CartoDB Dark Matter) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          maxZoom={19}
        />

        {/* Nexrad WMS Radar Overlay */}
        {showRadar && (
          <WMSTileLayer
            url="https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0r.cgi"
            layers="nexrad-n0r-900913"
            format="image/png"
            transparent={true}
            opacity={0.6}
            attribution="Weather data © Iowa Environmental Mesonet"
          />
        )}

        {/* Render Saved Locations */}
        {locations.map((loc) => (
          <Marker 
            key={loc.id} 
            position={[parseFloat(loc.lat), parseFloat(loc.lon)]}
          >
            <Popup className="glass-panel text-foreground">
              <div className="font-semibold text-sm">{loc.name}</div>
              <div className="text-xs text-muted-foreground mono-data mt-1">
                {loc.lat}, {loc.lon}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Map Controls */}
      <div className="absolute top-6 right-6 z-10 flex flex-col gap-2">
        <button
          onClick={() => setShowRadar(!showRadar)}
          className={`p-3 rounded-xl backdrop-blur-md shadow-lg transition-all duration-300 border ${
            showRadar 
              ? "bg-primary/20 border-primary/50 text-primary hover:bg-primary/30" 
              : "bg-card/80 border-white/10 text-muted-foreground hover:bg-card hover:text-foreground"
          }`}
          title="Toggle Radar Overlay"
        >
          <Layers className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
