import express from "express";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

import path from "path";
import { fileURLToPath } from "url";

import indexRouter from "../routes/index.js";
import healthRouter from "../routes/health.js";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(helmet());
app.use(compression());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use("/static", express.static(path.join(__dirname, "../public")));

app.use("/", indexRouter);
app.use("/health", healthRouter);

export default app;