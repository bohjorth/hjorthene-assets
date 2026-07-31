export default class Asset
{
    constructor(data)
    {
        this.id = data.id;

        this.filename = data.filename;

        this.original_name = data.original_name;

        this.extension = data.extension;

        this.mime_type = data.mime_type;

        this.size = data.size;

        this.hash = data.hash;

        this.created = data.created;
    }
}