import app from "./app.js";

import config from "../config/config.js";

app.listen(config.port, () => {

    console.log("");

    console.log("===================================");

    console.log(` ${config.appName}`);

    console.log("");

    console.log(` Listening on port ${config.port}`);

    console.log(` ${config.baseUrl}`);

    console.log("===================================");

});