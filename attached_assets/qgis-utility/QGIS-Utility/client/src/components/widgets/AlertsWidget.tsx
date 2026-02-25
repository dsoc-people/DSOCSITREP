import { useWeatherAlerts, useWeatherObservation, useWeatherForecast } from "@/hooks/use-weather";
import { AlertTriangle, Info, Bell, Thermometer, Navigation, CloudSun, ShieldAlert, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AlertsWidget() {
  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useWeatherAlerts();
  const { data: observation, isLoading: obsLoading, refetch: refetchObs } = useWeatherObservation();
  const { data: forecast, isLoading: forecastLoading, refetch: refetchForecast } = useWeatherForecast();

  const handleRefresh = () => {
    refetchAlerts();
    refetchObs();
    refetchForecast();
  };

  const hasAlerts = alerts && (alerts.warnings.length > 0 || alerts.watches.length > 0 || alerts.advisories.length > 0);

  return (
    <div className="flex flex-col gap-4 w-80 max-h-[85vh] selection:bg-primary/30">
      {/* Current Observation Widget */}
      <Card className="glass-panel border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <CardHeader className="py-3 px-4 border-b border-white/10 bg-card/40 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-bold flex items-center gap-2 tracking-wider uppercase text-foreground">
            <Thermometer className="w-4 h-4 text-primary" />
            BG Observation
          </CardTitle>
          <button onClick={handleRefresh} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`w-3 h-3 ${(obsLoading || alertsLoading || forecastLoading) ? 'animate-spin text-primary' : ''}`} />
          </button>
        </CardHeader>
        <CardContent className="p-4">
          {obsLoading ? (
            <div className="flex flex-col items-center justify-center py-4 space-y-2 opacity-50">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-[10px] uppercase font-bold tracking-tighter">Syncing Sensors...</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Temperature</span>
                <span className="text-2xl font-mono font-bold text-primary leading-none">{observation?.temp}<span className="text-sm ml-0.5 opacity-70">°F</span></span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Dewpoint</span>
                <span className="text-2xl font-mono font-bold text-foreground leading-none">{observation?.dewpoint}<span className="text-sm ml-0.5 opacity-70">°F</span></span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Wind Vector</span>
                <div className="flex items-center gap-2 font-mono font-bold text-sm text-foreground">
                  <Navigation className="w-3 h-3 text-primary/80" style={{ transform: `rotate(${observation?.windDir || 0}deg)` }} />
                  {observation?.windSpeed} <span className="text-[9px] font-black opacity-40">MPH</span>
                </div>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">10m Peak Gust</span>
                <span className="text-sm font-mono font-bold text-orange-500">{observation?.windGust} <span className="text-[9px] font-black opacity-40">MPH</span></span>
              </div>
              <div className="col-span-2 pt-3 border-t border-white/5 mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">Wet Bulb Globe Temp</span>
                  <span className="text-sm font-mono font-bold text-primary">{observation?.wetBulb}<span className="text-[10px] ml-0.5 opacity-70">°F</span></span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forecast Widget */}
      <Card className="glass-panel border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
        <CardHeader className="py-3 px-4 border-b border-white/10 bg-card/40">
          <CardTitle className="text-xs font-bold flex items-center gap-2 tracking-wider uppercase text-foreground">
            <CloudSun className="w-4 h-4 text-primary" />
            Gridpoint Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-44">
            {forecastLoading ? (
              <div className="p-8 text-center opacity-50">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                <span className="text-[10px] uppercase font-bold tracking-tighter">Calculating Grid...</span>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {forecast?.slice(0, 6).map((period: any, i: number) => (
                  <div key={i} className="p-3 hover:bg-white/5 transition-colors group">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{period.name}</span>
                      <span className="text-xs font-mono font-bold text-primary">{period.temperature}°{period.temperatureUnit}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{period.shortForecast}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Weather Alerts Widget */}
      <Card className="glass-panel border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-1000">
        <CardHeader className="py-3 px-4 border-b border-white/10 bg-card/40 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-xs font-bold flex items-center gap-2 tracking-wider uppercase text-foreground">
            <ShieldAlert className="w-4 h-4 text-primary" />
            Alerts Console
          </CardTitle>
          {hasAlerts && (
            <Badge variant="outline" className="bg-destructive/20 border-destructive/30 text-destructive text-[9px] font-black h-5">
              ACTIVE
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-40">
            {alertsLoading ? (
              <div className="p-8 text-center opacity-50">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                <span className="text-[10px] uppercase font-bold tracking-tighter">Scanning...</span>
              </div>
            ) : !hasAlerts ? (
              <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground opacity-30 group">
                <Bell className="w-10 h-10 mb-2 stroke-[1px] group-hover:scale-110 transition-transform" />
                <span className="text-[9px] uppercase font-black tracking-[0.2em]">All Systems Nominal</span>
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {alerts.warnings.map((alert: any) => (
                  <div key={alert.id} className="border-l-2 border-destructive pl-3 py-2 bg-destructive/5 rounded-r-md hover:bg-destructive/10 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="w-3 h-3 text-destructive" />
                      <span className="text-[9px] font-black text-destructive uppercase tracking-widest">Warning</span>
                    </div>
                    <h3 className="text-xs font-bold text-foreground leading-tight mb-1">{alert.event}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{alert.headline}</p>
                  </div>
                ))}

                {alerts.watches.map((alert: any) => (
                  <div key={alert.id} className="border-l-2 border-orange-500 pl-3 py-2 bg-orange-500/5 rounded-r-md hover:bg-orange-500/10 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-3 h-3 text-orange-500" />
                      <span className="text-[9px] font-black text-orange-500 uppercase tracking-widest">Watch</span>
                    </div>
                    <h3 className="text-xs font-bold text-foreground leading-tight mb-1">{alert.event}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{alert.headline}</p>
                  </div>
                ))}

                {alerts.advisories.map((alert: any) => (
                  <div key={alert.id} className="border-l-2 border-primary pl-3 py-2 bg-primary/5 rounded-r-md hover:bg-primary/10 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Info className="w-3 h-3 text-primary" />
                      <span className="text-[9px] font-black text-primary uppercase tracking-widest">Advisory</span>
                    </div>
                    <h3 className="text-xs font-bold text-foreground leading-tight mb-1">{alert.event}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{alert.headline}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
