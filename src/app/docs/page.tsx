import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Docs" };

function Code({ children }: { children: string }) {
  return (
    <pre className="scrollbar-thin overflow-x-auto rounded-lg bg-ink-900 p-4 font-mono text-xs text-ink-200">
      {children}
    </pre>
  );
}

export default function DocsPage() {
  return (
    <>
      <SiteHeader />
      <main className="container-page flex flex-col gap-8 py-16">
        <div>
          <h1 className="font-display text-3xl text-ink-50">Docs</h1>
          <p className="text-ink-400">How to sign up, upload a document, and ask it a question.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>1. Create a workspace</CardTitle>
            <CardDescription>Public and rate-limited - the response also sets your session cookie.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`curl -X POST https://your-passage-host/api/auth/signup \\
  -H "Content-Type: application/json" \\
  -c cookies.txt \\
  -d '{"email":"you@example.com","password":"correcthorsebattery","workspaceName":"Acme Inc."}'

# {"workspace": {"id": 1, "slug": "acme-inc", "name": "Acme Inc.", ...}}`}</Code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Upload a document</CardTitle>
            <CardDescription>PDF, DOCX, plain text, or Markdown - extracted, chunked, and indexed before this returns.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`curl -X POST https://your-passage-host/api/workspaces/acme-inc/documents \\
  -b cookies.txt \\
  -F "title=Vacation Policy" \\
  -F "file=@vacation-policy.pdf;type=application/pdf"

# {"document": {"id": 1, "status": "ready", ...}}
# status is "processing" -> "ready" or "failed" - check errorMessage if it failed.`}</Code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>3. Ask a question</CardTitle>
            <CardDescription>The answer is the literal cited passage, or an honest refusal - never a paraphrase.</CardDescription>
          </CardHeader>
          <CardContent>
            <Code>{`curl -X POST https://your-passage-host/api/workspaces/acme-inc/query \\
  -b cookies.txt \\
  -H "Content-Type: application/json" \\
  -d '{"question": "How many vacation days do I get?"}'

# {
#   "refused": false,
#   "confidence": 0.58,
#   "passage": {"id": 12, "text": "Employees accrue fifteen days...", "pageNumber": null},
#   "document": {"id": 1, "title": "Vacation Policy", "storageUrl": "/uploads/..."}
# }
#
# Below the confidence threshold, the response is instead:
# {"refused": true, "confidence": 0.04}`}</Code>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>A document is workspace-wide visible unless explicitly restricted.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-ink-400">
            <p>
              <code className="text-ink-200">PUT /api/workspaces/:slug/documents/:id/access</code> with{" "}
              <code className="text-ink-200">{`{"userIds": [2, 5]}`}</code> restricts a document to just those
              workspace members - only a workspace owner can change this. An empty array clears the restriction,
              making it workspace-wide visible again. Restricted documents never enter the retrieval corpus, the
              document listing, or the file-serving route for anyone not on the allowlist - not filtered afterward.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Slack</CardTitle>
            <CardDescription>Real HMAC-SHA256 request-signature verification, per Slack&apos;s documented scheme.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm text-ink-400">
            <p>
              An owner connects a Slack team with{" "}
              <code className="text-ink-200">PUT /api/workspaces/:slug/slack</code> ({`{"slackTeamId": "T..."}`}).
              Point a Slack slash command at <code className="text-ink-200">/api/slack/command</code> and set{" "}
              <code className="text-ink-200">SLACK_SIGNING_SECRET</code> in the environment. A slash command has no
              signed-in Passage user behind it, so it can only search documents visible to the whole workspace -
              never anything restricted to a specific allowlist.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rate limits</CardTitle>
            <CardDescription>Per-IP or per-user, in-process.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-ink-500">
                    <th className="pb-2 pr-4 font-medium">Endpoint</th>
                    <th className="pb-2 pr-4 font-medium">Limit</th>
                    <th className="pb-2 font-medium">Keyed by</th>
                  </tr>
                </thead>
                <tbody className="text-ink-300">
                  <tr className="border-t border-ink-800">
                    <td className="py-2 pr-4 font-mono text-xs">POST /api/auth/signup</td>
                    <td className="py-2 pr-4">10 / hour</td>
                    <td className="py-2">IP</td>
                  </tr>
                  <tr className="border-t border-ink-800">
                    <td className="py-2 pr-4 font-mono text-xs">POST /api/auth/login</td>
                    <td className="py-2 pr-4">10 / 5 minutes</td>
                    <td className="py-2">IP</td>
                  </tr>
                  <tr className="border-t border-ink-800">
                    <td className="py-2 pr-4 font-mono text-xs">POST /api/workspaces/:slug/query</td>
                    <td className="py-2 pr-4">60 / minute</td>
                    <td className="py-2">user</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
