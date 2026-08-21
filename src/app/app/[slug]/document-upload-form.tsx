"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function DocumentUploadForm({ slug }: { slug: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Choose a file");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const body = new FormData();
      body.set("title", title);
      body.set("file", file);

      // No Content-Type header here on purpose - the browser sets the
      // multipart boundary itself from the FormData body.
      const response = await fetch(`/api/workspaces/${slug}/documents`, { method: "POST", body });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Upload failed");
        return;
      }

      setTitle("");
      formRef.current?.reset();
      router.refresh();
    } catch {
      setError("Something went wrong - try again");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="doc-title">Title (optional)</Label>
        <Input id="doc-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Defaults to the filename" />
      </div>
      <div>
        <Label htmlFor="file">File</Label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          className="block w-full text-sm text-ink-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-800 file:px-3 file:py-2 file:text-ink-100"
        />
        <p className="mt-1 text-xs text-ink-500">Plain text, Markdown, PDF, or Word (.docx). Up to 50MB.</p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={uploading}>
        {uploading ? "Uploading and indexing…" : "Upload document"}
      </Button>
    </form>
  );
}
