import { Router } from "express";
import AssetController from "../src/controllers/AssetController.js";

const router = Router();

router.get("/", AssetController.index);
router.get("/upload", AssetController.uploadForm);

export default router;
