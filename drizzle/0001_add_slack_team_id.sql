ALTER TABLE "workspaces" ADD COLUMN "slack_team_id" text;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_slack_team_id_unique" UNIQUE("slack_team_id");