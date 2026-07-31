import dotenv from "dotenv";

dotenv.config();

export default {

    appName: process.env.APP_NAME,

    port: process.env.PORT || 3000,

    baseUrl: process.env.BASE_URL,

    logLevel: process.env.LOG_LEVEL || "info"

};