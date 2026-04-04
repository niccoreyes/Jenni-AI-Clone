import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pdfsTable = pgTable("pdfs", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  extractedText: text("extracted_text"),
  summary: text("summary"),
  pageCount: integer("page_count"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPdfSchema = createInsertSchema(pdfsTable).omit({ id: true, uploadedAt: true });
export type InsertPdf = z.infer<typeof insertPdfSchema>;
export type PdfDocument = typeof pdfsTable.$inferSelect;
