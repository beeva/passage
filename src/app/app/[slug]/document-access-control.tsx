"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { WorkspaceMember } from "./members-card";

export function DocumentAccessControl({
  slug,
  documentId,
  members,
}: {
  slug: string;
  documentId: number;
  members: WorkspaceMember[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function handleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${slug}/documents/${documentId}/access`);
      const data = (await response.json()) as { userIds?: number[]; error?: string };
      if (!response.ok) {
        setError(data.error ?? "Could not load access settings");
        return;
      }
      setSelected(new Set(data.userIds ?? []));
    } finally {
      setLoading(false);
    }
  }

  function toggle(userId: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${slug}/documents/${documentId}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [...selected] }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not save");
        return;
      }
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="inline-block">
      <Button variant="ghost" size="sm" onClick={handleOpen}>
        {open ? "Close" : "Access"}
      </Button>
      {open ? (
        <div className="mt-2 flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-900 p-3">
          {loading ? (
            <p className="text-xs text-ink-500">Loading…</p>
          ) : (
            <>
              <p className="text-xs text-ink-500">
                {selected.size === 0 ? "Visible to the whole workspace." : "Restricted to the people checked below."}
              </p>
              {members.map((member) => (
                <label key={member.userId} className="flex items-center gap-2 text-xs text-ink-200">
                  <input type="checkbox" checked={selected.has(member.userId)} onChange={() => toggle(member.userId)} />
                  {member.email}
                </label>
              ))}
              {error ? (
                <p role="alert" className="text-xs text-rose-400">
                  {error}
                </p>
              ) : null}
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
