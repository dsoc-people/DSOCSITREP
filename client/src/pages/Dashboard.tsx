import { useState } from "react";
import { TimePanel } from "@/components/TimePanel";
import { AlertsPanel } from "@/components/AlertsPanel";
import { LocationsPanel } from "@/components/LocationsPanel";
import { MapArea } from "@/components/MapArea";
import { ShieldCheck } from "lucide-react";

export default function Dashboard() {
  // Default center over central USA
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]);
  const [mapZoom, setMapZoom] = useState(4);

  const handleSelectLocation = (lat: number, lon: number) => {
    setMapCenter([lat, lon]);
    setMapZoom(9);
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans selection:bg-primary/30">
      
      {/* LEFT SIDEBAR - Dashboard Controls */}
      <aside className="w-[380px] h-full flex flex-col gap-4 p-4 z-10 bg-background/50 border-r border-border shadow-2xl backdrop-blur-xl">
        
        {/* Header/Logo Area */}
        <header className="flex items-center gap-3 px-2 pb-2">
          <div className="bg-primary/10 p-2 rounded-lg border border-primary/30">
            <ShieldCheck className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-none text-foreground uppercase">
              SA<span className="text-primary">GUI</span>
            </h1>
            <p className="text-[10px] font-mono-tech text-muted-foreground uppercase tracking-widest">
              Situational Awareness
            </p>
          </div>
        </header>

        <TimePanel />
        
        <AlertsPanel />
        
        <LocationsPanel onSelectLocation={handleSelectLocation} />
        
      </aside>

      {/* MAIN CONTENT - Interactive Map */}
      <main className="flex-1 h-full relative">
        <MapArea center={mapCenter} zoom={mapZoom} />
      </main>

    </div>
  );
}
