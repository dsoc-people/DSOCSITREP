import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertLocation } from "@shared/routes";

export function useLocations() {
  return useQuery({
    queryKey: [api.locations.list.path],
    queryFn: async () => {
      const res = await fetch(api.locations.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch locations");
      const data = await res.json();
      const result = api.locations.list.responses[200].safeParse(data);
      if (!result.success) {
        console.error("[Zod] Locations list validation failed:", result.error);
        return data; // Return raw data if parsing fails, but log error
      }
      return result.data;
    },
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: InsertLocation) => {
      const validated = api.locations.create.input.parse(data);
      const res = await fetch(api.locations.create.path, {
        method: api.locations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
        credentials: "include",
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Validation failed");
        }
        throw new Error("Failed to create location");
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.locations.list.path] });
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.locations.delete.path, { id });
      const res = await fetch(url, { 
        method: api.locations.delete.method,
        credentials: "include" 
      });
      
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete location");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.locations.list.path] });
    },
  });
}
