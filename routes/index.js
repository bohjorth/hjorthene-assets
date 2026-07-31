import { Router } from "express";
import AssetService from "../src/services/AssetService.js";

const router = Router();

router.get("/", (req, res) => {
    const stats = {
        assets: AssetService.count(),
        storage: AssetService.totalSizeFormatted(),
        users: 1
    };

    res.render("dashboard", {
        title: "Dashboard",
        stats
    });
});

export default router;
