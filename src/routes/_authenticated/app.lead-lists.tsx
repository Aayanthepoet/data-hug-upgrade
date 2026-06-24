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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, List, Calendar, ChevronRight, FileSpreadsheet } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/lead-lists")({
  head: () => ({ meta: [{ title: "Lead Lists — PropAI" }] }),
  component: LeadListsPage,
});

function LeadListsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsLoading] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["lead_lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_lists")
        .select("id, name, description, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("List name is required");
      return;
    }

    setIsLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error("You must be authenticated to create lists.");
      }

      const { error } = await supabase.from("lead_lists").insert({
        user_id: userData.user.id,
        name: name.trim(),
        description: description.trim() || null,
        filters: {}, // Default empty filters
      });

      if (error) throw error;

      toast.success("Lead list created successfully!");
      setIsOpen(false);
      
      // Reset form fields
      setName("");
      setDescription("");

      // Invalidate query to refresh list
      queryClient.invalidateQueries({ queryKey: ["lead_lists"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to create lead list");
    } finally {
      setIsLoading(false);
    }
  };

  const createDialog = (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create List
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[450px] border-border bg-[var(--bg)] text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <List className="text-cyan w-5 h-5" /> Create Lead List
          </DialogTitle>
          <DialogDescription className="text-sm text-[var(--w55)]">
            Organize property leads into a targeted segment to run direct marketing campaigns.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-1">
            <Label htmlFor="name">List Name *</Label>
            <Input
              id="name"
              placeholder="e.g. Albany High-Equity Preforeclosures"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[var(--s1)] border-border text-white"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="e.g. Highly motivated sellers in Albany County with >$100k equity"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-[var(--s1)] border-border text-white min-h-[100px]"
            />
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
              {isSubmitting ? "Creating..." : "Create List"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  if (isLoading) return <div className="text-[var(--w55)] p-8">Loading lists…</div>;

  if (!data?.length) {
    return (
      <EmptyModule
        eyebrow="Lead Lists"
        title={<>Saved <span className="h-italic">lists</span></>}
        description="Filter properties into named lists, then power campaigns from them."
        cta={createDialog}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="eyebrow inline-flex">
            <span className="eyebrow-dot" /> Lists
          </div>
          <h1 className="h-display text-[clamp(28px,4vw,44px)] mt-2">Lead Lists</h1>
        </div>
        <div>
          {createDialog}
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.map((list) => (
          <div key={list.id} className="surface p-6 flex flex-col justify-between hover:border-[var(--cyan-b)] transition-all group">
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-cyan-d/20 border border-[var(--cyan-b)] rounded-lg text-cyan">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-[var(--w35)] group-hover:text-cyan group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-bold group-hover:text-cyan transition-colors">{list.name}</h3>
              <p className="text-sm text-[var(--w55)] mt-2 line-clamp-2 min-h-[40px]">
                {list.description || "No description provided."}
              </p>
            </div>
            
            <div className="mt-6 pt-4 border-t border-border flex items-center gap-2 text-xs text-[var(--w35)]">
              <Calendar className="w-3.5 h-3.5" />
              <span>Created {new Date(list.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}