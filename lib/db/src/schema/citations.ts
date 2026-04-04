import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const citationsTable = pgTable("citations", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull(),
  sourceId: text("source_id").notNull(),
  author: text("author").notNull(),
  year: text("year"),
  title: text("title").notNull(),
  journal: text("journal"),
  volume: text("volume"),
  pages: text("pages"),
  doi: text("doi"),
  url: text("url"),
  pdfId: integer("pdf_id"),
  citationStyle: text("citation_style").notNull().default("APA7"),
  formatted: text("formatted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCitationSchema = createInsertSchema(citationsTable).omit({ id: true, createdAt: true });
export type InsertCitation = z.infer<typeof insertCitationSchema>;
export type Citation = typeof citationsTable.$inferSelect;
