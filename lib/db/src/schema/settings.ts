import { pgTable, text, serial, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const settingsTable = pgTable("settings", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull().default("openai"),
  apiKey: text("api_key"),
  baseUrl: text("base_url"),
  model: text("model").notNull().default("gpt-5.2"),
  defaultCitationStyle: text("default_citation_style").notNull().default("APA7"),
  language: text("language").notNull().default("en-US"),
  userRole: text("user_role").notNull().default("graduate"),
  autocompleteEnabled: boolean("autocomplete_enabled").notNull().default(true),
  citationsEnabled: boolean("citations_enabled").notNull().default(true),
  pdfChatEnabled: boolean("pdf_chat_enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSettingsSchema = createInsertSchema(settingsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
export type Settings = typeof settingsTable.$inferSelect;
