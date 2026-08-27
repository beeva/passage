import { boolean, doublePrecision, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;

export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // Null until an owner connects a Slack workspace to this one. A single
  // Passage workspace can be connected to at most one Slack team - the
  // unique constraint is what makes a slash command's team_id resolve to
  // exactly one Passage workspace, not an ambiguous set.
  slackTeamId: text("slack_team_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Workspace = typeof workspaces.$inferSelect;

export type WorkspaceRole = "owner" | "member";

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<WorkspaceRole>().notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_members_workspace_user_idx").on(table.workspaceId, table.userId),
    index("workspace_members_user_idx").on(table.userId),
  ]
);

export type DocumentStatus = "processing" | "ready" | "failed";

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    sourceFilename: text("source_filename").notNull(),
    contentType: text("content_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    storageUrl: text("storage_url").notNull(),
    status: text("status").$type<DocumentStatus>().notNull().default("processing"),
    errorMessage: text("error_message"),
    uploadedByUserId: integer("uploaded_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("documents_workspace_idx").on(table.workspaceId)]
);

export type Document = typeof documents.$inferSelect;

// A document with no rows here is visible to every member of its
// workspace - that's the default, not an edge case, since most documents
// in practice should just be readable by the team that uploaded them.
// Rows here are an allowlist that narrows visibility to specific people,
// checked in every retrieval/listing query rather than trusted from a
// client-supplied flag.
export const documentAccess = pgTable(
  "document_access",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("document_access_document_user_idx").on(table.documentId, table.userId)]
);

export const passages = pgTable(
  "passages",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    // Denormalized from documents.workspaceId - every retrieval query
    // filters by workspace first, and joining through documents for that
    // on every search would be needless overhead for a value that never
    // changes independently of the document it belongs to.
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    text: text("text").notNull(),
    pageNumber: integer("page_number"),
    charStart: integer("char_start").notNull(),
    charEnd: integer("char_end").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("passages_document_idx").on(table.documentId),
    index("passages_workspace_idx").on(table.workspaceId),
  ]
);

export type Passage = typeof passages.$inferSelect;

export const queries = pgTable(
  "queries",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // Null for a query with no real Passage account behind it - a Slack
    // slash command, which only proves which Slack team/channel asked,
    // not which individual Passage user (see the comment on
    // listUnrestrictedPassagesForWorkspace).
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    questionText: text("question_text").notNull(),
    answeredPassageId: integer("answered_passage_id").references(() => passages.id, { onDelete: "set null" }),
    confidence: doublePrecision("confidence").notNull(),
    refused: boolean("refused").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("queries_workspace_created_idx").on(table.workspaceId, table.createdAt)]
);
