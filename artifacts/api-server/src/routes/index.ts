import { Router, type IRouter } from "express";
import healthRouter from "./health";
import documentsRouter from "./documents";
import citationsRouter from "./citations";
import pdfsRouter from "./pdfs";
import settingsRouter from "./settings";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(documentsRouter);
router.use(citationsRouter);
router.use(pdfsRouter);
router.use(settingsRouter);
router.use(aiRouter);

export default router;
