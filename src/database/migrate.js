import fs from "fs";
import db from "./db.js";

const sql = fs.readFileSync(
    "./src/database/schema.sql",
    "utf8"
);

db.exec(sql);

console.log("Database ready.");