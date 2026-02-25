import { useState } from "react";
import { MapPin, Navigation, Plus, Trash2, Crosshair } from "lucide-react";
import { useLocations, useCreateLocation, useDeleteLocation } from "@/hooks/use-locations";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton
} from "@/components/ui/sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface AppSidebarProps {
  onLocationSelect: (lat: number, lon: number) => void;
}

export function AppSidebar({ onLocationSelect }: AppSidebarProps) {
  const { data: locations, isLoading } = useLocations();
  const createLocation = useCreateLocation();
  const deleteLocation = useDeleteLocation();
  const { toast } = useToast();
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", lat: "", lon: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createLocation.mutate(formData, {
      onSuccess: () => {
        setIsAddOpen(false);
        setFormData({ name: "", lat: "", lon: "" });
        toast({ title: "Location saved", description: `${formData.name} added to tracking.` });
      },
      onError: (err) => {
        toast({ variant: "destructive", title: "Error", description: err.message });
      }
    });
  };

  const handleDelete = (id: number, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Remove ${name} from tracking?`)) {
      deleteLocation.mutate(id, {
        onSuccess: () => toast({ title: "Location removed" })
      });
    }
  };

  return (
    <Sidebar className="border-r border-white/10 bg-sidebar">
      <SidebarHeader className="p-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
            <Crosshair className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-foreground tracking-tight leading-none">SAGUI</h1>
            <p className="text-[10px] text-primary font-mono uppercase tracking-widest mt-1">Situational Awareness</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground mb-2 px-4">
            Tracked Coordinates
            
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <button className="p-1 hover:bg-white/10 rounded-md transition-colors text-foreground">
                  <Plus className="w-4 h-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-card border-white/10 text-foreground">
                <DialogHeader>
                  <DialogTitle>Add Target Location</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-muted-foreground">Target Name / Identifier</Label>
                    <Input 
                      id="name" 
                      placeholder="e.g., Forward Operating Base Alpha" 
                      value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      required
                      className="bg-background/50 border-white/10 focus-visible:ring-primary/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="lat" className="text-muted-foreground">Latitude</Label>
                      <Input 
                        id="lat" 
                        placeholder="38.8951" 
                        value={formData.lat}
                        onChange={e => setFormData({...formData, lat: e.target.value})}
                        required
                        className="bg-background/50 border-white/10 mono-data focus-visible:ring-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lon" className="text-muted-foreground">Longitude</Label>
                      <Input 
                        id="lon" 
                        placeholder="-77.0364" 
                        value={formData.lon}
                        onChange={e => setFormData({...formData, lon: e.target.value})}
                        required
                        className="bg-background/50 border-white/10 mono-data focus-visible:ring-primary/50"
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button 
                      type="submit" 
                      disabled={createLocation.isPending}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {createLocation.isPending ? "Configuring..." : "Establish Tracking"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isLoading ? (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Scanning vectors...
                </div>
              ) : locations?.length === 0 ? (
                <div className="px-4 py-6 text-center">
                  <MapPin className="w-8 h-8 mx-auto mb-2 opacity-20 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">No coordinates established.</p>
                </div>
              ) : (
                locations?.map((loc) => (
                  <SidebarMenuItem key={loc.id}>
                    <div className="w-full flex items-center justify-between group hover:bg-white/5 h-14 px-4 transition-colors">
                      <SidebarMenuButton 
                        onClick={() => onLocationSelect(parseFloat(loc.lat), parseFloat(loc.lon))}
                        className="flex-1 flex items-start gap-3 overflow-hidden p-0 hover:bg-transparent"
                      >
                        <Navigation className="w-4 h-4 text-primary/70 mt-0.5 shrink-0 group-hover:text-primary transition-colors" />
                        <div className="flex flex-col items-start overflow-hidden">
                          <span className="font-medium text-sm truncate w-full">{loc.name}</span>
                          <span className="text-[10px] text-muted-foreground mono-data opacity-70 mt-0.5">
                            {Number(loc.lat).toFixed(4)}, {Number(loc.lon).toFixed(4)}
                          </span>
                        </div>
                      </SidebarMenuButton>
                      <button 
                        onClick={(e) => handleDelete(loc.id, loc.name, e)}
                        className="opacity-0 group-hover:opacity-100 p-2 text-muted-foreground hover:text-destructive transition-all rounded-md hover:bg-destructive/10 shrink-0"
                        title="Delete target"
                        data-testid={`button-delete-location-${loc.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
