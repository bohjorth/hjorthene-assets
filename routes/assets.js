import { Router } from "express";
import AssetController from "../src/controllers/AssetController.js";
import upload from "../src/middleware/upload.js";

const router = Router();

router.get("/", AssetController.index);
router.get("/upload", AssetController.uploadForm);
router.post("/upload", upload.single("asset"), AssetController.upload);

export default router;
