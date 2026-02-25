import { useTime } from "@/hooks/use-time";
import { Clock, Globe } from "lucide-react";

export function TimePanel() {
  const { localTime, localDate, localZone, utcTime, utcDate } = useTime();

  return (
    <div className="glass-panel rounded-lg p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Globe className="w-4 h-4 text-primary" />
            <span className="text-xs uppercase font-bold tracking-wider">UTC Time (Z)</span>
          </div>
          <div className="font-mono-tech text-3xl font-bold text-foreground tracking-tight shadow-sm">
            {utcTime}
          </div>
          <div className="font-mono-tech text-xs text-muted-foreground mt-1">
            {utcDate}
          </div>
        </div>
      </div>

      <div className="flex flex-col pt-1">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-xs uppercase font-bold tracking-wider">Local Time</span>
        </div>
        <div className="font-mono-tech text-2xl font-bold text-foreground/90 tracking-tight">
          {localTime}
        </div>
        <div className="font-mono-tech text-xs text-muted-foreground mt-1 flex justify-between">
          <span>{localDate}</span>
          <span className="text-primary/70">{localZone}</span>
        </div>
      </div>
    </div>
  );
}
