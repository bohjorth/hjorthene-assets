import db from "../database/db.js";

class AssetService {

    static count() {
        try {
            const row = db.prepare("SELECT COUNT(*) AS total FROM assets").get();
            return row.total;
        } catch {
            return 0;
        }
    }

    static totalSize() {
        try {
            const row = db.prepare("SELECT COALESCE(SUM(size),0) AS total FROM assets").get();
            return row.total;
        } catch {
            return 0;
        }
    }

    static totalSizeFormatted() {
        const bytes = this.totalSize();

        if (bytes < 1024)
            return `${bytes} B`;

        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;

        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / 1024 / 1024).toFixed(1)} MB`;

        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }

}

export default AssetService;
