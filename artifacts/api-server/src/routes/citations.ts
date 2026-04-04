import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, citationsTable } from "@workspace/db";
import {
  CreateCitationBody,
  ListCitationsQueryParams,
  ListCitationsResponse,
  DeleteCitationParams,
} from "@workspace/api-zod";
import { nanoid } from "nanoid";

const router: IRouter = Router();

function formatCitation(
  data: {
    author: string;
    year?: string | null;
    title: string;
    journal?: string | null;
    volume?: string | null;
    pages?: string | null;
    doi?: string | null;
    url?: string | null;
  },
  style: string
): string {
  const { author, year, title, journal, volume, pages, doi } = data;
  const yr = year ?? "n.d.";

  switch (style) {
    case "MLA9":
      return `${author}. "${title}." ${journal ? `*${journal}*` : ""} ${volume ? `vol. ${volume}` : ""} ${pages ? `pp. ${pages}` : ""}`.trim().replace(/\s+/g, " ");
    case "Chicago17":
      return `${author}. "${title}." ${journal ? `*${journal}*` : ""} ${volume ?? ""} (${yr})${pages ? `: ${pages}` : ""}.${doi ? ` https://doi.org/${doi}` : ""}`.trim();
    case "IEEE":
      return `${author}, "${title}," *${journal ?? ""}*, vol. ${volume ?? "?"}, pp. ${pages ?? "?"}, ${yr}.`;
    case "Harvard":
      return `${author} (${yr}) '${title}', *${journal ?? ""}*, ${volume ? `vol. ${volume}` : ""}${pages ? `, pp. ${pages}` : ""}.`;
    case "APA7":
    default:
      return `${author} (${yr}). ${title}.${journal ? ` *${journal}*` : ""}${volume ? `, *${volume}*` : ""}${pages ? `, ${pages}` : ""}.${doi ? ` https://doi.org/${doi}` : ""}`;
  }
}

router.get("/citations", async (req, res): Promise<void> => {
  const params = ListCitationsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const citations = await db
    .select()
    .from(citationsTable)
    .where(eq(citationsTable.documentId, params.data.documentId));

  res.json(ListCitationsResponse.parse(citations));
});

router.post("/citations", async (req, res): Promise<void> => {
  const parsed = CreateCitationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const formatted = formatCitation(parsed.data, parsed.data.citationStyle);
  const sourceId = nanoid(10);

  const [citation] = await db
    .insert(citationsTable)
    .values({ ...parsed.data, formatted, sourceId })
    .returning();

  res.status(201).json(citation);
});

router.delete("/citations/:id", async (req, res): Promise<void> => {
  const params = DeleteCitationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [citation] = await db
    .delete(citationsTable)
    .where(eq(citationsTable.id, params.data.id))
    .returning();

  if (!citation) {
    res.status(404).json({ error: "Citation not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
