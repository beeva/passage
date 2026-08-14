import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listWorkspacesForUser } from "@/lib/db/queries";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Your workspaces" };

export default async function AppHomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const workspaces = await listWorkspacesForUser(session.userId);

  return (
    <main className="container-page flex flex-col gap-8 py-16">
      <h1 className="font-display text-2xl text-ink-50">Your workspaces</h1>
      {workspaces.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-ink-400">You&apos;re not a member of any workspace yet.</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <Card key={workspace.id}>
              <CardHeader>
                <CardTitle>{workspace.name}</CardTitle>
                <CardDescription>{workspace.role}</CardDescription>
              </CardHeader>
              <CardContent>
                <LinkButton href={`/app/${workspace.slug}`} variant="outline" size="sm">
                  Open
                </LinkButton>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
