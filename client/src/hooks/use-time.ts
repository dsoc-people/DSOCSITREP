import { useState, useEffect } from 'react';
import { format } from 'date-fns';

export function useTime() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return {
    localTime: format(time, 'HH:mm:ss'),
    localDate: format(time, 'yyyy-MM-dd'),
    localZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    utcTime: time.toISOString().substring(11, 19),
    utcDate: time.toISOString().substring(0, 10),
  };
}
