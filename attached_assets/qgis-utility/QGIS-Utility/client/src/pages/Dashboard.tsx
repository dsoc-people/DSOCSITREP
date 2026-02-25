import { useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { WeatherMap } from "@/components/map/WeatherMap";
import { TimeWidget } from "@/components/widgets/TimeWidget";
import { AlertsWidget } from "@/components/widgets/AlertsWidget";
import { useLocations } from "@/hooks/use-locations";

export default function Dashboard() {
  // Default CONUS center
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]);
  const [mapZoom, setMapZoom] = useState(5);
  
  const { data: locations } = useLocations();

  const handleLocationSelect = (lat: number, lon: number) => {
    setMapCenter([lat, lon]);
    setMapZoom(9); // Zoom in closer when selecting a specific target
  };

  const sidebarStyle = {
    "--sidebar-width": "18rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
        
        <AppSidebar onLocationSelect={handleLocationSelect} />
        
        {/* Main Content Area */}
        <main className="relative flex-1 h-full w-full flex flex-col">
          
          {/* Header Bar - sits above the map slightly */}
          <header className="absolute top-0 left-0 w-full p-4 z-20 flex items-start justify-between pointer-events-none">
            {/* Sidebar trigger needs pointer events */}
            <div className="pointer-events-auto">
              <SidebarTrigger className="p-2 bg-card/80 backdrop-blur-md border border-white/10 rounded-lg text-foreground hover:bg-white/10 transition-colors shadow-lg" />
            </div>
            
            {/* Time Widget */}
            <div className="pointer-events-auto">
              <TimeWidget />
            </div>
          </header>

          {/* Alert Widget Layered over Map */}
          <div className="absolute bottom-6 left-6 z-20 pointer-events-auto">
            <AlertsWidget />
          </div>

          {/* Map Layer */}
          <div className="flex-1 w-full h-full relative z-0">
            <WeatherMap 
              center={mapCenter} 
              zoom={mapZoom} 
              locations={locations || []}
            />
          </div>

        </main>

      </div>
    </SidebarProvider>
  );
}
