import { Router } from "express";
import AssetController from "../src/controllers/AssetController.js";

const router = Router();

router.get("/", AssetController.index);

export default router;