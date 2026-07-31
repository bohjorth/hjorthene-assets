import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {

    res.json({

        status: "ok",

        service: "hjorthene-assets",

        version: "0.1.0",

        uptime: process.uptime()

    });

});

export default router;