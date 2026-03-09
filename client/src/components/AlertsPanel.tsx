import { AlertTriangle, ShieldAlert, Cloud, Thermometer, Wind, Droplets } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ObservationData {
  temp: string;
  dewpoint: string;
  windSpeed: string;
  windDir: string;
  windGust: string;
  wetBulb: string;
}

interface Alert {
  id: string;
  event: string;
  headline: string;
  severity: string;
  expires: string | null;
}

interface AlertsData {
  warnings: Alert[];
  watches: Alert[];
  advisories: Alert[];
}

export function AlertsPanel() {
  // Weatherstem Observations via Backend Proxy
  const { data: observations, isLoading: obsLoading } = useQuery<ObservationData>({
    queryKey: ["/api/weather/observation"],
    refetchInterval: 60000,
  });

  // Alerts for Warren County via Backend Proxy
  const { data: alertsData } = useQuery<AlertsData>({
    queryKey: ["/api/weather/alerts"],
    refetchInterval: 60000,
  });

  const warnings = alertsData?.warnings || [];
  const watches = alertsData?.watches || [];
  const advisories = alertsData?.advisories || [];

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-2 custom-scrollbar">
      {/* Current Observations */}
      <div className="glass-panel rounded-lg p-4 border-l-4 border-l-primary">
        <h3 className="text-sm font-bold uppercase tracking-wider text-primary flex items-center gap-2 mb-3">
          <Cloud className="w-4 h-4" />
          Observations (WKU Chaos)
        </h3>
        {obsLoading ? (
          <div className="animate-pulse h-16 bg-muted/20 rounded"></div>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div className="flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">Temp</span>
                <span className="text-sm font-mono-tech font-bold">
                  {observations?.temp !== "N/A" ? `${observations?.temp}°F` : "--"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">Wind</span>
                <span className="text-sm font-mono-tech font-bold">
                  {observations?.windSpeed !== "N/A" ? `${observations?.windSpeed} mph` : "--"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Droplets className="w-4 h-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">Dewpoint</span>
                <span className="text-sm font-mono-tech font-bold">
                  {observations?.dewpoint !== "N/A" ? `${observations?.dewpoint}°F` : "--"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">Wet Bulb Globe Temp</span>
                <span className="text-sm font-mono-tech font-bold">
                  {observations?.wetBulb !== "N/A" ? `${observations?.wetBulb}°F` : "--"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="glass-panel rounded-lg p-4 border-l-4 border-l-destructive">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Warnings
            </h3>
            <span className="bg-destructive/10 text-destructive text-xs font-bold px-2 py-0.5 rounded-full">
              {warnings.length} Active
            </span>
          </div>
          <div className="space-y-2">
            {warnings.map((alert) => (
              <div key={alert.id} className="bg-background/50 rounded p-2 text-sm border border-destructive/20">
                <div className="font-bold text-foreground">{alert.event}</div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  {alert.headline}
                </div>
                {alert.expires && (
                  <div className="text-[10px] text-destructive font-bold mt-1 uppercase">
                    Expires: {new Date(alert.expires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watches/Advisories */}
      {(watches.length > 0 || advisories.length > 0) && (
        <div className="glass-panel rounded-lg p-4 border-l-4 border-l-[hsl(var(--warning))]">
           <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--warning))] flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Alerts/Watches
            </h3>
            <span className="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] text-xs font-bold px-2 py-0.5 rounded-full">
              {watches.length + advisories.length} Active
            </span>
          </div>
          <div className="space-y-2">
            {[...watches, ...advisories].map((alert) => (
              <div key={alert.id} className="bg-background/50 rounded p-2 text-sm border border-[hsl(var(--warning))]/20">
                <div className="font-bold text-foreground">{alert.event}</div>
                <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                  {alert.headline}
                </div>
                {alert.expires && (
                  <div className="text-[10px] text-[hsl(var(--warning))] font-bold mt-1 uppercase">
                    Expires: {new Date(alert.expires).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
