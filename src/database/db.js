import Database from "better-sqlite3";
import fs from "fs";

if (!fs.existsSync("./database"))
{
    fs.mkdirSync("./database");
}

const db = new Database("./database/assets.db");

db.pragma("journal_mode = WAL");

export default db;