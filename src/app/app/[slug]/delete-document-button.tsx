"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DeleteDocumentButton({ slug, documentId, title }: { slug: string; documentId: number; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!confirm(`Delete "${title}"? This removes it and its indexed passages.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/workspaces/${slug}/documents/${documentId}`, { method: "DELETE" });
      if (response.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={busy}>
      Remove
    </Button>
  );
}
