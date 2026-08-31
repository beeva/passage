import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="container-page flex flex-col gap-16 py-24">
        <div className="flex flex-col items-start gap-6">
          <h1 className="font-display text-4xl text-ink-50 sm:text-5xl">
            Answers, <span className="text-gradient">cited to the exact passage</span>
          </h1>
          <p className="max-w-2xl text-lg text-ink-400">
            Ask a question in plain language and get back the literal passage it came from - not a paraphrase you
            have to take on faith. Real hybrid retrieval, a confidence threshold, and an honest refusal when nothing
            in the corpus actually answers the question.
          </p>
          <LinkButton href="/login" size="lg">
            Sign in
          </LinkButton>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Cited, not paraphrased</CardTitle>
              <CardDescription>Every answer is the source text itself, with a link back to it.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Hybrid retrieval</CardTitle>
              <CardDescription>Real BM25 plus vector-space cosine similarity, fused by rank.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Knows what it doesn&apos;t know</CardTitle>
              <CardDescription>Below a confidence threshold, Passage says so instead of guessing.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </main>
    </>
  );
}
