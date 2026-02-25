import { useState } from "react";
import { useLocations, useCreateLocation, useDeleteLocation } from "@/hooks/use-locations";
import { MapPin, Plus, Trash2, Navigation, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface LocationsPanelProps {
  onSelectLocation: (lat: number, lon: number) => void;
}

export function LocationsPanel({ onSelectLocation }: LocationsPanelProps) {
  const { data: locations, isLoading } = useLocations();
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();
  const [isOpen, setIsOpen] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLocation.mutate(
      { name, lat, lon },
      {
        onSuccess: () => {
          setIsOpen(false);
          setName("");
          setLat("");
          setLon("");
        }
      }
    );
  };

  return (
    <div className="glass-panel rounded-lg p-4 flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
          <MapPin className="w-4 h-4 text-primary" />
          Saved Locations
        </h3>
        
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/20 transition-colors">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card text-foreground border-border sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Favorite Location</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Location Name</Label>
                <Input 
                  id="name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. KBNG Airport" 
                  className="bg-background border-border"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lat">Latitude</Label>
                  <Input 
                    id="lat" 
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="36.96" 
                    className="bg-background border-border font-mono-tech"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lon">Longitude</Label>
                  <Input 
                    id="lon" 
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    placeholder="-86.44" 
                    className="bg-background border-border font-mono-tech"
                    required
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-semibold"
                disabled={createLocation.isPending}
              >
                {createLocation.isPending ? "Saving..." : "Save Location"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : locations?.length === 0 ? (
          <div className="text-center text-muted-foreground text-xs py-8 border border-dashed border-border/50 rounded-lg">
            No saved locations
          </div>
        ) : (
          locations?.map(loc => (
            <div 
              key={loc.id} 
              className="bg-background/40 hover:bg-secondary/80 border border-border/50 rounded p-3 transition-colors group cursor-pointer"
              onClick={() => onSelectLocation(parseFloat(loc.lat), parseFloat(loc.lon))}
            >
              <div className="flex justify-between items-start">
                <div className="font-medium text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                  <Navigation className="w-3 h-3 text-muted-foreground group-hover:text-primary" />
                  {loc.name}
                </div>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive/20 hover:text-destructive transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteLocation.mutate(loc.id);
                  }}
                  disabled={deleteLocation.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono-tech mt-1 flex gap-3">
                <span>Lat: {loc.lat}</span>
                <span>Lon: {loc.lon}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
