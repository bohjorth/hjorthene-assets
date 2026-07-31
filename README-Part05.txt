# Part 05

Tilføj følgende til routes/assets.js:

import upload from "../src/middleware/upload.js";

GET /upload -> render("assets/upload")
POST /upload -> upload.single("asset")

Denne pakke forbereder upload-middleware. Næste del gemmer metadata i databasen.
