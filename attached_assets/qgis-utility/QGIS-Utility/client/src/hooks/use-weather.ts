import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useWeatherAlerts(zone?: string) {
  return useQuery({
    queryKey: [api.weather.alerts.path, zone],
    queryFn: async () => {
      let url = api.weather.alerts.path;
      if (zone) {
        url += `?zone=${encodeURIComponent(zone)}`;
      }
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch weather alerts");
      
      const data = await res.json();
      
      // Since it uses z.any() arrays in the schema, safeParse will generally pass, 
      // but logging helps track shape changes
      const result = api.weather.alerts.responses[200].safeParse(data);
      if (!result.success) {
        console.error("[Zod] Weather alerts validation failed:", result.error);
        return data; 
      }
      return result.data;
    },
    // Refresh alerts every 2 minutes for situational awareness
    refetchInterval: 120000,
  });
}

export function useWeatherObservation() {
  return useQuery({
    queryKey: [api.weather.observation.path],
    queryFn: async () => {
      const res = await fetch(api.weather.observation.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch weather observation");
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useWeatherForecast() {
  return useQuery({
    queryKey: [api.weather.forecast.path],
    queryFn: async () => {
      const res = await fetch(api.weather.forecast.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch weather forecast");
      return res.json();
    },
    refetchInterval: 3600000, // Refresh every hour
  });
}
