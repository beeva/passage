"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface QueryResponse {
  refused: boolean;
  confidence: number;
  passage?: { id: number; text: string; pageNumber: number | null };
  document?: { id: number; title: string; storageUrl: string } | null;
  error?: string;
}

export function AskQuestionForm({ slug }: { slug: string }) {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/workspaces/${slug}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = (await response.json()) as QueryResponse;
      if (!response.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      setResult(data);
    } catch {
      setError("Something went wrong - try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a question about your documents…"
          required
          className="flex-1"
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Searching…" : "Ask"}
        </Button>
      </form>

      {error ? (
        <p role="alert" className="text-sm text-rose-400">
          {error}
        </p>
      ) : null}

      {result ? (
        result.refused ? (
          <Card>
            <CardContent className="flex flex-col gap-2 py-6">
              <Badge tone="warning">No confident match</Badge>
              <p className="text-sm text-ink-300">
                Nothing in your documents answers this with enough confidence to cite. Try rephrasing, or check that
                the relevant document has actually been uploaded and finished indexing.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-amber-500/40">
            <CardContent className="flex flex-col gap-3 py-6">
              <div className="flex items-center gap-2">
                <Badge tone="cited">Cited passage</Badge>
                <span className="text-xs text-ink-500">confidence {(result.confidence * 100).toFixed(0)}%</span>
              </div>
              <blockquote className="border-l-2 border-amber-500 pl-4 text-ink-100">{result.passage!.text}</blockquote>
              {result.document ? (
                <p className="text-xs text-ink-500">
                  From{" "}
                  <a href={result.document.storageUrl} className="text-indigo-400 hover:text-indigo-300">
                    {result.document.title}
                  </a>
                  {result.passage!.pageNumber ? ` · page ${result.passage!.pageNumber}` : ""}
                </p>
              ) : null}
            </CardContent>
          </Card>
        )
      ) : null}
    </div>
  );
}
