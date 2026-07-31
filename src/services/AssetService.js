import AssetRepository from "../repositories/AssetRepository.js";

class AssetService {
    static getAll(){ return AssetRepository.getAll(); }
    static count(){ return AssetRepository.count(); }
    static totalSize(){ return AssetRepository.totalSize(); }

    static totalSizeFormatted(){
        const bytes=this.totalSize();
        if(bytes<1024) return `${bytes} B`;
        if(bytes<1024*1024) return `${(bytes/1024).toFixed(1)} KB`;
        if(bytes<1024*1024*1024) return `${(bytes/1024/1024).toFixed(1)} MB`;
        return `${(bytes/1024/1024/1024).toFixed(2)} GB`;
    }

    static create(asset){
        if(!asset) throw new Error("Asset mangler.");
        if(!asset.filename) throw new Error("Filename mangler.");
        return AssetRepository.create(asset);
    }
}
export default AssetService;
