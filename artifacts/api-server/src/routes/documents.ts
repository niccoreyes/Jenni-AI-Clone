import { Router, type IRouter } from "express";
import { eq, desc, sql, count } from "drizzle-orm";
import { db, documentsTable, citationsTable, pdfsTable } from "@workspace/db";
import {
  CreateDocumentBody,
  UpdateDocumentBody,
  GetDocumentParams,
  UpdateDocumentParams,
  DeleteDocumentParams,
  ListDocumentsResponse,
  GetDocumentResponse,
  UpdateDocumentResponse,
  GetDocumentStatsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/documents/stats", async (req, res): Promise<void> => {
  const [docStats] = await db
    .select({ total: count() })
    .from(documentsTable);

  const [wordStats] = await db
    .select({ total: sql<number>`coalesce(sum(${documentsTable.wordCount}), 0)` })
    .from(documentsTable);

  const [citStats] = await db
    .select({ total: count() })
    .from(citationsTable);

  const [pdfStats] = await db
    .select({ total: count() })
    .from(pdfsTable);

  const recentDocuments = await db
    .select()
    .from(documentsTable)
    .orderBy(desc(documentsTable.updatedAt))
    .limit(5);

  res.json(GetDocumentStatsResponse.parse({
    totalDocuments: docStats?.total ?? 0,
    totalWords: Number(wordStats?.total ?? 0),
    totalCitations: citStats?.total ?? 0,
    totalPdfs: pdfStats?.total ?? 0,
    recentDocuments,
  }));
});

router.get("/documents", async (_req, res): Promise<void> => {
  const documents = await db
    .select()
    .from(documentsTable)
    .orderBy(desc(documentsTable.updatedAt));
  res.json(ListDocumentsResponse.parse(documents));
});

router.post("/documents", async (req, res): Promise<void> => {
  const parsed = CreateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = {
    ...parsed.data,
    content: parsed.data.content ?? "",
    wordCount: parsed.data.content
      ? parsed.data.content.split(/\s+/).filter(Boolean).length
      : 0,
  };

  const [doc] = await db.insert(documentsTable).values(data).returning();
  res.status(201).json(GetDocumentResponse.parse(doc));
});

router.get("/documents/:id", async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.id, params.data.id));

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json(GetDocumentResponse.parse(doc));
});

router.put("/documents/:id", async (req, res): Promise<void> => {
  const params = UpdateDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.content != null) {
    updateData.wordCount = parsed.data.content.split(/\s+/).filter(Boolean).length;
  }

  const [doc] = await db
    .update(documentsTable)
    .set(updateData)
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json(UpdateDocumentResponse.parse(doc));
});

router.delete("/documents/:id", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [doc] = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, params.data.id))
    .returning();

  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
