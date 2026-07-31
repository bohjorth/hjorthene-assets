import { Router } from "express";
import AssetService from "../src/services/AssetService.js";

const router = Router();

router.get("/", (req, res) => {
    const assets = AssetService.getAll();

    res.render("assets/index", {
        title: "Assets",
        assets
    });
});

export default router;
