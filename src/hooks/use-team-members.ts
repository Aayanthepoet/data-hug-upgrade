import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TeamMember = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TeamMember[];
    },
  });
}

export function memberLabel(m: TeamMember | undefined | null) {
  if (!m) return "Unassigned";
  return m.full_name?.trim() || m.email || m.id.slice(0, 8);
}
