import AssetRepository from "../repositories/AssetRepository.js";

class AssetService {

    static getAll() {
        return AssetRepository.getAll();
    }

    static count() {
        return AssetRepository.count();
    }

    static totalSize() {
        return AssetRepository.totalSize();
    }

    static totalSizeFormatted() {

        const bytes = this.totalSize();

        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / 1024 / 1024).toFixed(1)} MB`;

        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }
}

export default AssetService;
