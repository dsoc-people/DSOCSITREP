import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

const MOCK_ALERTS = [
  {
    id: 1,
    type: "warning",
    title: "Tornado Warning",
    area: "KYC021",
    time: "Valid until 04:30Z",
  },
  {
    id: 2,
    type: "watch",
    title: "Severe Thunderstorm Watch",
    area: "Regional",
    time: "Valid until 08:00Z",
  },
  {
    id: 3,
    type: "advisory",
    title: "High Wind Advisory",
    area: "Regional",
    time: "Valid until 12:00Z",
  }
];

export function AlertsPanel() {
  const warnings = MOCK_ALERTS.filter(a => a.type === "warning");
  const watches = MOCK_ALERTS.filter(a => a.type === "watch");
  const advisories = MOCK_ALERTS.filter(a => a.type === "advisory");

  return (
    <div className="flex flex-col gap-3">
      {/* Warnings */}
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
          {warnings.map(alert => (
            <div key={alert.id} className="bg-background/50 rounded p-2 text-sm border border-destructive/20">
              <div className="font-bold text-foreground">{alert.title}</div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono-tech">
                <span>{alert.area}</span>
                <span>{alert.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Watches */}
      <div className="glass-panel rounded-lg p-4 border-l-4 border-l-[hsl(var(--warning))]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--warning))] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Watches
          </h3>
          <span className="bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] text-xs font-bold px-2 py-0.5 rounded-full">
            {watches.length} Active
          </span>
        </div>
        <div className="space-y-2">
          {watches.map(alert => (
            <div key={alert.id} className="bg-background/50 rounded p-2 text-sm border border-[hsl(var(--warning))]/20">
              <div className="font-bold text-foreground">{alert.title}</div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono-tech">
                <span>{alert.area}</span>
                <span>{alert.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Advisories */}
      <div className="glass-panel rounded-lg p-4 border-l-4 border-l-[hsl(var(--accent))]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[hsl(var(--accent))] flex items-center gap-2">
            <Info className="w-4 h-4" />
            Advisories
          </h3>
          <span className="bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] text-xs font-bold px-2 py-0.5 rounded-full">
            {advisories.length} Active
          </span>
        </div>
        <div className="space-y-2">
          {advisories.map(alert => (
            <div key={alert.id} className="bg-background/50 rounded p-2 text-sm border border-[hsl(var(--accent))]/20">
              <div className="font-bold text-foreground">{alert.title}</div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1 font-mono-tech">
                <span>{alert.area}</span>
                <span>{alert.time}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
