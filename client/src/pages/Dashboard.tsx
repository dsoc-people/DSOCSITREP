import { useState } from "react";
import { TimePanel } from "@/components/TimePanel";
import { AlertsPanel } from "@/components/AlertsPanel";
import { MapArea } from "@/components/MapArea";
import { ShieldCheck, ChevronLeft, ChevronRight, AlertTriangle, ShieldAlert, Info, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

import dsocLogo from "@assets/image_1772208714711.png";

export default function Dashboard() {
  // Default center over Bowling Green, KY (WKU)
  const [mapCenter] = useState<[number, number]>([36.9850, -86.4550]);
  const [mapZoom] = useState(13);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Layers
  const [showRadar, setShowRadar] = useState(true);
  const [radarOpacity, setRadarOpacity] = useState(0.65);
  const [showSatellite, setShowSatellite] = useState(false);
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.5);
  // GOES-East CONUS default: Band 14 (long-wave IR)
  const [satelliteBand, setSatelliteBand] = useState('ch14');

  // SPC Layer Toggles
  const [showDay1, setShowDay1] = useState(false);
  const [showDay2, setShowDay2] = useState(false);
  const [showDay3, setShowDay3] = useState(false);
  const [showTornado, setShowTornado] = useState(false);

  const { data: alertsData } = useQuery<any>({
    queryKey: ["/api/weather/alerts"],
    refetchInterval: 60000,
  });

  const { data: soundingData } = useQuery<any>({
    queryKey: ["/api/weather/sounding"],
    refetchInterval: 300000,
  });

  const { data: stationsData } = useQuery<any[]>({
    queryKey: ["/api/weather/ky-stations"],
    refetchInterval: 300000,
  });

  const warningsCount = alertsData?.warnings?.length || 0;
  const watchesCount = alertsData?.watches?.length || 0;
  const advisoriesCount = alertsData?.advisories?.length || 0;

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans selection:bg-primary/30 flex-col md:flex-row">

      {/* Top Alerts Bar */}
      <div className="absolute top-0 left-0 right-0 h-10 z-[600] flex items-center justify-center gap-2 md:gap-6 px-2 md:px-4 pointer-events-none">
        <div className="bg-background/80 backdrop-blur-md border border-border/50 rounded-full px-3 md:px-6 py-1 shadow-xl flex items-center gap-3 md:gap-6 pointer-events-auto scale-90 md:scale-100">
          <div className="flex items-center gap-1 md:gap-2">
            <AlertTriangle className={`w-3 md:w-3.5 h-3 md:h-3.5 ${warningsCount > 0 ? "text-destructive animate-pulse" : "text-muted-foreground"}`} />
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Warnings:</span>
            <span className={`text-[10px] md:text-xs font-mono-tech font-bold ${warningsCount > 0 ? "text-destructive" : "text-muted-foreground"}`}>{warningsCount}</span>
          </div>
          <div className="w-px h-3 bg-border/50"></div>
          <div className="flex items-center gap-1 md:gap-2">
            <ShieldAlert className={`w-3 md:w-3.5 h-3 md:h-3.5 ${watchesCount > 0 ? "text-[hsl(var(--warning))]" : "text-muted-foreground"}`} />
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Watches:</span>
            <span className={`text-[10px] md:text-xs font-mono-tech font-bold ${watchesCount > 0 ? "text-[hsl(var(--warning))]" : "text-muted-foreground"}`}>{watchesCount}</span>
          </div>
          <div className="w-px h-3 bg-border/50"></div>
          <div className="flex items-center gap-1 md:gap-2">
            <Info className={`w-3 md:w-3.5 h-3 md:h-3.5 ${advisoriesCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-[8px] md:text-[10px] font-black uppercase tracking-widest hidden sm:inline">Advisories:</span>
            <span className={`text-[10px] md:text-xs font-mono-tech font-bold ${advisoriesCount > 0 ? "text-primary" : "text-muted-foreground"}`}>{advisoriesCount}</span>
          </div>
        </div>
      </div>

      {/* SIDEBAR - Dashboard Controls */}
      <aside 
        className={`${
          sidebarCollapsed ? "w-0 p-0 overflow-hidden border-r-0" : "w-full md:w-[380px] p-4 border-r"
        } h-full flex flex-col gap-4 z-[700] bg-background/95 md:bg-background/50 border-border shadow-2xl backdrop-blur-xl transition-all duration-300 fixed md:relative pt-16 md:pt-12`}
      >
        {!sidebarCollapsed && (
          <>
            {/* Header/Logo Area */}
            <header className="flex flex-col gap-3 px-2 pb-4 border-b border-border/50">
              <div className="relative w-full aspect-[3/1] overflow-hidden rounded-lg">
                <img 
                  src={dsocLogo} 
                  alt="DSOC Logo" 
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono-tech text-muted-foreground uppercase tracking-widest">
                  Situational Awareness
                </p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden"
                  onClick={() => setSidebarCollapsed(true)}
                >
                  <ChevronLeft className="w-6 h-6" />
                </Button>
              </div>
            </header>

            <Tabs defaultValue="layers" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid grid-cols-1 bg-muted/20">
                <TabsTrigger value="layers" className="text-[10px] font-black uppercase tracking-widest">Map Layers</TabsTrigger>
              </TabsList>

              <TabsContent
                value="layers"
                className="flex-1 mt-4 overflow-y-auto pr-2 pb-6"
              >
                <div className="glass-panel rounded-lg p-4 h-full flex flex-col gap-4 border-l-4 border-l-primary/30">
                  {/* Overlay Controls */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                      <Layers className="w-3 h-3" />
                      Radar & Satellite
                    </h3>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="radar" checked={showRadar} onCheckedChange={(c) => setShowRadar(!!c)} />
                            <Label htmlFor="radar" className="text-[10px] font-bold uppercase cursor-pointer">Live Radar</Label>
                          </div>
                          <span className="text-[10px] font-mono-tech font-bold text-primary">{Math.round(radarOpacity * 100)}%</span>
                        </div>
                        <Slider 
                          value={[radarOpacity]} 
                          min={0} 
                          max={1} 
                          step={0.01} 
                          onValueChange={([val]) => setRadarOpacity(val)}
                          disabled={!showRadar}
                        />
                      </div>

                      <div className="space-y-2 pt-2 border-t border-border/30">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center space-x-2">
                            <Checkbox id="satellite" checked={showSatellite} onCheckedChange={(c) => setShowSatellite(!!c)} />
                            <Label htmlFor="satellite" className="text-[10px] font-bold uppercase cursor-pointer">Satellite</Label>
                          </div>
                          <span className="text-[10px] font-mono-tech font-bold text-primary">{Math.round(satelliteOpacity * 100)}%</span>
                        </div>

                        <div className="space-y-3">
                          <Select value={satelliteBand} onValueChange={setSatelliteBand} disabled={!showSatellite}>
                            <SelectTrigger className="h-7 text-[9px] font-bold uppercase bg-muted/30">
                              <SelectValue placeholder="Select Band" />
                            </SelectTrigger>
                            <SelectContent className="z-[800]">
                              <SelectItem value="ch01">Band 01: Visible (Blue)</SelectItem>
                              <SelectItem value="ch02">Band 02: Visible (Red 0.64µm)</SelectItem>
                              <SelectItem value="ch03">Band 03: Veggie (NIR)</SelectItem>
                              <SelectItem value="ch04">Band 04: Cirrus (NIR)</SelectItem>
                              <SelectItem value="ch05">Band 05: Snow/Ice (NIR)</SelectItem>
                              <SelectItem value="ch06">Band 06: Particle Size (NIR)</SelectItem>
                              <SelectItem value="ch07">Band 07: Shortwave IR</SelectItem>
                              <SelectItem value="ch08">Band 08: Upper-level WV (6.2µm)</SelectItem>
                              <SelectItem value="ch09">Band 09: Mid-level WV</SelectItem>
                              <SelectItem value="ch10">Band 10: Lower-level WV</SelectItem>
                              <SelectItem value="ch11">Band 11: Cloud Top Phase</SelectItem>
                              <SelectItem value="ch12">Band 12: Ozone</SelectItem>
                              <SelectItem value="ch13">Band 13: Clean (LWIR)</SelectItem>
                              <SelectItem value="ch14">Band 14: Long-wave IR (11.2µm)</SelectItem>
                              <SelectItem value="ch15">Band 15: Dirty (LWIR)</SelectItem>
                              <SelectItem value="ch16">Band 16: CO2 (LWIR)</SelectItem>
                            </SelectContent>
                          </Select>

                          <Slider 
                            value={[satelliteOpacity]} 
                            min={0} 
                            max={1} 
                            step={0.01} 
                            onValueChange={([val]) => setSatelliteOpacity(val)}
                            disabled={!showSatellite}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SPC Overlays */}
                  <div>
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">SPC Outlooks</h3>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="flex items-center space-x-2">
                        <Checkbox id="day1" checked={showDay1} onCheckedChange={(c) => setShowDay1(!!c)} />
                        <Label htmlFor="day1" className="text-[10px] font-bold uppercase cursor-pointer">Day 1</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="day2" checked={showDay2} onCheckedChange={(c) => setShowDay2(!!c)} />
                        <Label htmlFor="day2" className="text-[10px] font-bold uppercase cursor-pointer">Day 2</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="day3" checked={showDay3} onCheckedChange={(c) => setShowDay3(!!c)} />
                        <Label htmlFor="day3" className="text-[10px] font-bold uppercase cursor-pointer">Day 3</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox id="tornado" checked={showTornado} onCheckedChange={(c) => setShowTornado(!!c)} />
                        <Label htmlFor="tornado" className="text-[10px] font-bold uppercase cursor-pointer text-destructive">Tornado</Label>
                      </div>
                    </div>
                  </div>

                  {/* Upper Air / Sounding */}
                  <div className="flex-1 overflow-hidden border border-border/30 rounded-lg bg-card/40 flex flex-col">
                    <div className="p-3 border-b border-border/30 bg-muted/10 flex items-center justify-between">
                      <h2 className="text-[10px] font-black uppercase tracking-widest text-primary">Upper Air / Sounding (OHX)</h2>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-4">
                        <pre className="text-[9px] font-mono-tech leading-relaxed whitespace-pre-wrap text-foreground/90 select-text">
                          {soundingData?.text || "Loading Latest Sounding Data..."}
                        </pre>
                      </div>
                    </ScrollArea>
                  </div>

                  <AlertsPanel />
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </aside>

      {/* Sidebar Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        className="absolute top-4 left-4 z-[500] bg-card/80 backdrop-blur border-border/50"
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
      >
        {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </Button>

      {/* MAIN CONTENT - Interactive Map */}
      <main className="flex-1 h-full relative z-0">
        <MapArea 
          center={mapCenter} 
          zoom={mapZoom} 
          showDay1={showDay1}
          showDay2={showDay2}
          showDay3={showDay3}
          showTornado={showTornado}
          showRadar={showRadar}
          radarOpacity={radarOpacity}
          showSatellite={showSatellite}
          satelliteOpacity={satelliteOpacity}
          satelliteBand={satelliteBand}
          stations={stationsData}
        />

        {/* YouTube Embed Tool Window */}
        <div className="absolute top-4 right-4 md:right-14 z-[400] glass-panel rounded-lg overflow-hidden border border-border/50 shadow-2xl scale-75 md:scale-100 origin-top-right">
          <iframe 
            width="320" 
            height="180" 
            src="https://www.youtube.com/embed/_PUdkBjyV2A?si=MWgx-TYLPNxdL6w_&autoplay=1&mute=1" 
            title="YouTube video player" 
            frameBorder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
            referrerPolicy="strict-origin-when-cross-origin" 
            allowFullScreen
            className="max-w-[100vw]"
          ></iframe>
        </div>

        {/* Floating Time Panel - Bottom Right */}
        <div className="absolute bottom-6 right-6 z-[400] w-64 scale-90 md:scale-100 origin-bottom-right hidden sm:block">
           <TimePanel />
        </div>

        {/* Mobile Time Panel Snippet */}
        <div className="absolute bottom-4 left-4 right-4 z-[400] sm:hidden">
          <div className="glass-panel rounded-lg p-3 text-center text-[10px] font-mono-tech font-bold uppercase tracking-widest bg-background/80 border border-border/50">
            Link Active - System Nominal
          </div>
        </div>
      </main>

    </div>
  );
}
