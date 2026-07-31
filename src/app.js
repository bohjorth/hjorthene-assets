import express from "express";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

import indexRouter from "../routes/index.js";
import healthRouter from "../routes/health.js";

const app = express();

app.use(helmet());

app.use(compression());

app.use(express.json());

app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

app.use("/", indexRouter);

app.use("/health", healthRouter);

export default app;