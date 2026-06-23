import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Facebook, Instagram, Loader2 } from "@/components/icons/SocialIcons";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  listAvailableMetaAccounts,
  saveMetaAccountSelection,
} from "@/lib/social-oauth.functions";
import { listMySocialAccounts } from "@/lib/social.functions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MetaAccountPicker({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAvailableMetaAccounts);
  const saveFn = useServerFn(saveMetaAccountSelection);
  const listAcctsFn = useServerFn(listMySocialAccounts);

  const [pageIds, setPageIds] = useState<Set<string>>(new Set());
  const [igIds, setIgIds] = useState<Set<string>>(new Set());

  const q = useQuery({
    queryKey: ["meta-available-accounts"],
    queryFn: () => listFn(),
    enabled: open,
  });
  const connectedQ = useQuery({
    queryKey: ["my-social-accounts"],
    queryFn: () => listAcctsFn(),
    enabled: open,
  });

  const pages = q.data?.pages ?? [];
  const connectedIds = new Set(
    (connectedQ.data ?? []).map((a) => a.external_account_id),
  );

  // When data first loads, default-select everything.
  useMemo(() => {
    if (q.data && pageIds.size === 0 && igIds.size === 0) {
      setPageIds(new Set(pages.map((p) => p.external_id)));
      setIgIds(
        new Set(
          pages.filter((p) => p.linked_instagram).map((p) => p.linked_instagram!.external_id),
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          pages: pages
            .filter((p) => pageIds.has(p.external_id))
            .map((p) => ({ external_id: p.external_id, name: p.name, avatar_url: p.avatar_url })),
          instagram: pages
            .map((p) => p.linked_instagram)
            .filter((i): i is NonNullable<typeof i> => i !== null && igIds.has(i.external_id))
            .map((i) => ({
              external_id: i.external_id,
              username: i.username,
              avatar_url: i.avatar_url,
            })),
        },
      }),
    onSuccess: (res) => {
      toast.success(`Connected ${res.count} account${res.count === 1 ? "" : "s"}.`);
      qc.invalidateQueries({ queryKey: ["my-social-accounts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePage = (id: string) => {
    setPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleIg = (id: string) => {
    setIgIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalSelected = pageIds.size + igIds.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose Pages & Instagram accounts</DialogTitle>
          <DialogDescription>
            Select which Facebook Pages and Instagram Business accounts to publish to. You can change this anytime.
            {q.data?.simulated ? " · Simulated data" : ""}
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="py-10 flex items-center justify-center text-[var(--w55)]">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading accounts…
          </div>
        ) : (
          <div className="space-y-4 max-h-[420px] overflow-y-auto py-2">
            {pages.map((p) => (
              <div key={p.external_id} className="border border-border rounded-lg p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <Checkbox
                    checked={pageIds.has(p.external_id)}
                    onCheckedChange={() => togglePage(p.external_id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Facebook className="w-4 h-4 text-[#1877F2]" />
                      {p.name}
                    </div>
                    <p className="text-xs text-[var(--w55)] mt-0.5">Facebook Page · {p.external_id}</p>
                  </div>
                </label>
                {p.linked_instagram && (
                  <label className="flex items-center gap-3 cursor-pointer mt-2 ml-7 pt-2 border-t border-border">
                    <Checkbox
                      checked={igIds.has(p.linked_instagram.external_id)}
                      onCheckedChange={() => toggleIg(p.linked_instagram!.external_id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm">
                        <Instagram className="w-4 h-4 text-[#E1306C]" />
                        {p.linked_instagram.username}
                      </div>
                      <p className="text-xs text-[var(--w55)]">Instagram Business · linked to this Page</p>
                    </div>
                  </label>
                )}
                {!p.linked_instagram && (
                  <p className="text-xs text-[var(--w35)] mt-2 ml-7">No Instagram Business account linked to this Page</p>
                )}
              </div>
            ))}
            {pages.length === 0 && (
              <p className="text-sm text-[var(--w55)] text-center py-6">
                No Pages found. You need at least one Facebook Page admin role.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} className="btn-ghost px-4 py-2">
            Cancel
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || totalSelected === 0}
            className="btn-primary px-4 py-2"
          >
            {saveMut.isPending ? "Saving…" : `Connect ${totalSelected} account${totalSelected === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
