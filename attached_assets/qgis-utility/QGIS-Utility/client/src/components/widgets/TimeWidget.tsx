import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Clock, Globe } from "lucide-react";

export function TimeWidget() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format UTC
  const utcDate = format(
    new Date(time.getTime() + time.getTimezoneOffset() * 60000),
    "yyyy-MM-dd"
  );
  const utcTime = format(
    new Date(time.getTime() + time.getTimezoneOffset() * 60000),
    "HH:mm:ss"
  );

  // Format Local
  const localDate = format(time, "yyyy-MM-dd");
  const localTime = format(time, "HH:mm:ss");

  return (
    <div className="glass-panel p-4 rounded-2xl flex flex-col gap-3 min-w-[280px] animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <div className="flex items-center gap-2 text-primary">
          <Globe className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wider uppercase">UTC (Zulu)</span>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold mono-data text-foreground tracking-tight">
            {utcTime}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
            {utcDate}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-semibold tracking-wider uppercase">Local</span>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold mono-data text-foreground/80 tracking-tight">
            {localTime}
          </div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
            {localDate}
          </div>
        </div>
      </div>
    </div>
  );
}
