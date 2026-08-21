import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getWorkspaceForMember, listDocumentsForWorkspace } from "@/lib/db/queries";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes, formatDate } from "@/lib/utils";
import type { DocumentStatus } from "@/lib/db/schema";
import { DocumentUploadForm } from "./document-upload-form";
import { AskQuestionForm } from "./ask-question-form";
import { DeleteDocumentButton } from "./delete-document-button";

const STATUS_TONE: Record<DocumentStatus, "good" | "warning" | "critical"> = {
  ready: "good",
  processing: "warning",
  failed: "critical",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: slug };
}

export default async function WorkspacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const resolved = await getWorkspaceForMember(slug, session.userId);
  if (!resolved) notFound();

  const documents = await listDocumentsForWorkspace(resolved.workspace.id);

  return (
    <main className="container-page flex flex-col gap-8 py-16">
      <h1 className="font-display text-2xl text-ink-50">{resolved.workspace.name}</h1>

      <Card>
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
        </CardHeader>
        <CardContent>
          <AskQuestionForm slug={slug} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload a document</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentUploadForm slug={slug} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <p className="text-sm text-ink-500">No documents yet.</p>
          ) : (
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-ink-500">
                    <th className="pb-2 pr-4 font-medium">Title</th>
                    <th className="pb-2 pr-4 font-medium">Size</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Uploaded</th>
                    <th className="pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => (
                    <tr key={document.id} className="border-t border-ink-800 text-ink-200">
                      <td className="py-2 pr-4">{document.title}</td>
                      <td className="py-2 pr-4 text-xs text-ink-400">{formatBytes(document.fileSizeBytes)}</td>
                      <td className="py-2 pr-4">
                        <Badge tone={STATUS_TONE[document.status]}>{document.status}</Badge>
                        {document.status === "failed" && document.errorMessage ? (
                          <span className="ml-2 text-xs text-rose-400">{document.errorMessage}</span>
                        ) : null}
                      </td>
                      <td className="py-2 pr-4 text-xs text-ink-400">{formatDate(document.createdAt)}</td>
                      <td className="py-2">
                        <DeleteDocumentButton slug={slug} documentId={document.id} title={document.title} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
