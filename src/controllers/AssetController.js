import AssetService from "../services/AssetService.js";

class AssetController {

    static index(req, res) {

        const assets = AssetService.getAll();

        res.render("assets/index", {
            title: "Assets",
            assets
        });

    }

}

export default AssetController;
