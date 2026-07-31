import crypto from "crypto";
import AssetService from "../services/AssetService.js";

class AssetController {
    static index(req,res){
        const assets=AssetService.getAll();
        res.render("assets/index",{title:"Assets",assets});
    }

    static uploadForm(req,res){
        res.render("assets/upload",{title:"Upload Asset"});
    }

    static upload(req,res){
        try{
            if(!req.file){
                return res.status(400).render("assets/upload",{
                    title:"Upload Asset",
                    error:"Du skal vælge en fil."
                });
            }

            AssetService.create({
                id: crypto.randomUUID(),
                filename:req.file.filename,
                originalname:req.file.originalname,
                extension:req.file.originalname.split(".").pop()?.toLowerCase() ?? "",
                mimetype:req.file.mimetype,
                size:req.file.size,
                hash:""
            });

            res.redirect("/assets");
        }catch(err){
            console.error(err);
            res.status(500).render("assets/upload",{
                title:"Upload Asset",
                error:"Upload mislykkedes."
            });
        }
    }
}

export default AssetController;
