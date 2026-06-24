import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { EmptyModule } from "@/components/app/EmptyModule";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Search, MapPin, DollarSign, Home } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/properties")({
  head: () => ({ meta: [{ title: "Properties — PropAI" }] }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsLoading] = useState(false);

  // Form states
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [leadScore, setLeadScore] = useState("50");
  const [isPreforeclosure, setIsPreforeclosure] = useState(false);
  const [isVacant, setIsVacant] = useState(false);
  const [isAbsentee, setIsAbsentee] = useState(false);
  const [distressType, setDistressType] = useState<string>("none");

  const { data, isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, address, city, state, zip, estimated_value, lead_score, is_preforeclosure, is_vacant, is_absentee")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) {
      toast.error("Address is required");
      return;
    }

    setIsLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("You must be authenticated to add properties.");
      }

      const { error } = await supabase.from("properties").insert({
        user_id: userData.user.id,
        address: address.trim(),
        city: city.trim() || null,
        state: state.trim().toUpperCase() || null,
        zip: zip.trim() || null,
        estimated_value: estimatedValue ? parseFloat(estimatedValue) : null,
        lead_score: leadScore ? parseInt(leadScore, 10) : null,
        is_preforeclosure: isPreforeclosure,
        is_vacant: isVacant,
        is_absentee: isAbsentee,
        distress_type: (distressType as any) || "none",
      });

      if (error) throw error;

      toast.success("Property record added successfully!");
      setIsOpen(false);
      
      // Reset form fields
      setAddress("");
      setCity("");
      setState("");
      setZip("");
      setEstimatedValue("");
      setLeadScore("50");
      setIsPreforeclosure(false);
      setIsVacant(false);
      setIsAbsentee(false);
      setDistressType("none");

      // Invalidate query to refresh table
      queryClient.invalidateQueries({ queryKey: ["properties"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to add property record");
    } finally {
      setIsLoading(false);
    }
  };

  const createDialog = (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Property
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] border-border bg-[var(--bg)] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Home className="text-cyan w-5 h-5" /> Add Property Record
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--w55)]">
            Create a custom property profile to track value, distress status, and outreach.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="address">Street Address *</Label>
            <Input
              id="address"
              placeholder="e.g. 123 Main St"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="bg-[var(--s1)] border-border text-white"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-1">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="e.g. Albany"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="bg-[var(--s1)] border-border text-white"
              />
            </div>
            <div className="space-y-1 col-span-1">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                placeholder="e.g. NY"
                maxLength={2}
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="bg-[var(--s1)] border-border text-white"
              />
            </div>
            <div className="space-y-1 col-span-1">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                placeholder="e.g. 12203"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                className="bg-[var(--s1)] border-border text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="value" className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-gold" /> Estimated Value
              </Label>
              <Input
                id="value"
                type="number"
                placeholder="e.g. 350000"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                className="bg-[var(--s1)] border-border text-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="score">Lead Score (0-100)</Label>
              <Input
                id="score"
                type="number"
                min="0"
                max="100"
                value={leadScore}
                onChange={(e) => setLeadScore(e.target.value)}
                className="bg-[var(--s1)] border-border text-white"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="distress">Distress Type</Label>
            <Select value={distressType} onValueChange={setDistressType}>
              <SelectTrigger className="bg-[var(--s1)] border-border text-white">
                <SelectValue placeholder="Select distress status" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--bg)] border-border text-white">
                <SelectItem value="none">None / Healthy</SelectItem>
                <SelectItem value="preforeclosure">Pre-foreclosure</SelectItem>
                <SelectItem value="reo">REO / Bank-Owned</SelectItem>
                <SelectItem value="auction">Scheduled Auction</SelectItem>
                <SelectItem value="tax_lien">Tax Lien</SelectItem>
                <SelectItem value="tax_delinquent">Tax Delinquent</SelectItem>
                <SelectItem value="fsbo_stale">Stale FSBO</SelectItem>
                <SelectItem value="vacant">Vacant</SelectItem>
                <SelectItem value="absentee">Absentee Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Pre-foreclosure</Label>
                <p className="text-xs text-[var(--w35)]">Has an active Notice of Default (NOD)</p>
              </div>
              <Switch checked={isPreforeclosure} onCheckedChange={setIsPreforeclosure} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Vacant Property</Label>
                <p className="text-xs text-[var(--w35)]">Registered as vacant or high utility signal</p>
              </div>
              <Switch checked={isVacant} onCheckedChange={setIsVacant} />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm">Absentee Owner</Label>
                <p className="text-xs text-[var(--w35)]">Owner address differs from property address</p>
              </div>
              <Switch checked={isAbsentee} onCheckedChange={setIsAbsentee} />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="hover:bg-[rgba(255,255,255,0.05)] text-white"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="btn-primary">
              {isSubmitting ? "Adding..." : "Add Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) return <div className="text-[var(--w55)] p-8">Loading properties…</div>;

  if (!data?.length) {
    return (
      <EmptyModule
        eyebrow="Properties"
        title={<>Property <span className="h-italic">intelligence</span></>}
        description="Nationwide property records with equity, distress signals, and AI lead scoring."
        cta={
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/app/properties/search">
              <Button variant="outline" className="border-border text-white hover:bg-[rgba(255,255,255,0.05)] flex items-center gap-2">
                <Search className="w-4 h-4 text-cyan" /> Find & Import Properties
              </Button>
            </Link>
            {createDialog}
          </div>
        }
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="eyebrow inline-flex">
            <span className="eyebrow-dot" /> Properties
          </div>
          <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-2">Workspace</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/app/properties/search">
            <Button variant="outline" className="border-border text-white hover:bg-[rgba(255,255,255,0.05)] flex items-center gap-2">
              <Search className="w-4 h-4 text-cyan" /> Search Properties
            </Button>
          </Link>
          {createDialog}
        </div>
      </div>

      <div className="surface overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--w55)] text-xs uppercase tracking-widest bg-[rgba(0,0,0,0.1)]">
            <tr>
              <th className="p-4">Address</th>
              <th className="p-4">City</th>
              <th className="p-4">Value</th>
              <th className="p-4">Score</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-[rgba(255,255,255,.02)] transition-colors">
                <td className="p-4">
                  <Link to="/app/properties/$propertyId" params={{ propertyId: p.id }} className="text-cyan hover:underline font-medium">
                    {p.address}
                  </Link>
                </td>
                <td className="p-4">
                  {p.city ? `${p.city}, ${p.state || ""} ${p.zip || ""}` : "—"}
                </td>
                <td className="p-4">
                  {p.estimated_value ? `$${Number(p.estimated_value).toLocaleString()}` : "—"}
                </td>
                <td className="p-4">
                  {p.lead_score !== null ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold font-mono ${
                      p.lead_score >= 80 ? "text-cyan bg-cyan-d/20" : p.lead_score >= 50 ? "text-gold bg-gold/10" : "text-[var(--w45)] bg-white/5"
                    }`}>
                      {p.lead_score}
                    </span>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}