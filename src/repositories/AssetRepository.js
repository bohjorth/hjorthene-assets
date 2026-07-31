import db from "../database/db.js";

class AssetRepository {

    static getAll() {
        return db.prepare(`
            SELECT *
            FROM assets
            ORDER BY created DESC
        `).all();
    }

    static count() {
        const row = db.prepare("SELECT COUNT(*) AS total FROM assets").get();
        return row.total;
    }

    static totalSize() {
        const row = db.prepare(
            "SELECT COALESCE(SUM(size),0) AS total FROM assets"
        ).get();

        return row.total;
    }
}

export default AssetRepository;
