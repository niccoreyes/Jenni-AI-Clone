import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, pdfsTable } from "@workspace/db";
import { ListPdfsResponse, DeletePdfParams } from "@workspace/api-zod";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

const router: IRouter = Router();

router.get("/pdfs", async (_req, res): Promise<void> => {
  const pdfs = await db.select().from(pdfsTable);
  res.json(ListPdfsResponse.parse(pdfs));
});

router.post("/pdfs/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No PDF file provided" });
    return;
  }

  const [pdf] = await db
    .insert(pdfsTable)
    .values({
      filename: req.file.filename,
      originalName: req.file.originalname,
      extractedText: null,
      summary: null,
      pageCount: null,
    })
    .returning();

  res.status(201).json(pdf);
});

router.delete("/pdfs/:id", async (req, res): Promise<void> => {
  const params = DeletePdfParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [pdf] = await db
    .delete(pdfsTable)
    .where(eq(pdfsTable.id, params.data.id))
    .returning();

  if (!pdf) {
    res.status(404).json({ error: "PDF not found" });
    return;
  }

  const filePath = path.join(uploadDir, pdf.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  res.sendStatus(204);
});

export default router;
