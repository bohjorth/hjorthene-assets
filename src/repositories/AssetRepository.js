import db from "../database/db.js";

class AssetRepository{
    static getAll(){
        return db.prepare(`SELECT * FROM assets ORDER BY created DESC`).all();
    }

    static count(){
        return db.prepare("SELECT COUNT(*) AS total FROM assets").get().total;
    }

    static totalSize(){
        return db.prepare("SELECT COALESCE(SUM(size),0) AS total FROM assets").get().total;
    }

    static create(asset){
        const stmt=db.prepare(`
            INSERT INTO assets
            (id, filename, original_name, extension, mime_type, size, hash)
            VALUES
            (@id,@filename,@original_name,@extension,@mime_type,@size,@hash)
        `);

        return stmt.run({
            id:asset.id,
            filename:asset.filename,
            original_name:asset.originalname,
            extension:asset.extension,
            mime_type:asset.mimetype,
            size:asset.size,
            hash:asset.hash
        });
    }
}
export default AssetRepository;
