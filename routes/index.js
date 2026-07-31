import { Router } from "express";

const router = Router();

router.get("/", (req, res) => {

    res.send(`

    <html>

    <head>

        <title>Hjorthene Assets</title>

        <style>

            body{

                font-family:Arial;

                background:#1f2937;

                color:white;

                padding:60px;

            }

            h1{

                color:#4ade80;

            }

            .card{

                background:#374151;

                border-radius:12px;

                padding:30px;

                max-width:700px;

            }

        </style>

    </head>

    <body>

        <div class="card">

            <h1>Hjorthene Assets</h1>

            <p>Version 0.1</p>

            <p>Projektet er installeret.</p>

            <p><a href="/health">Health endpoint</a></p>

        </div>

    </body>

    </html>

    `);

});

export default router;