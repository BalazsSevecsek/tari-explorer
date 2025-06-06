// Copyright 2022 The Tari Project
// SPDX-License-Identifier: BSD-3-Clause

import express from "express";
import path from "path";
import pinoHttp from "pino-http";
import asciichart from "asciichart";
import cors from "cors";
import favicon from "serve-favicon";
import hbs from "hbs";

// Route imports
import indexRouter from "./routes/index.js";
import blockDataRouter from "./routes/block_data.js";
import blocksRouter from "./routes/blocks.js";
import mempoolRouter from "./routes/mempool.js";
import minersRouter from "./routes/miners.js";
import searchCommitmentsRouter from "./routes/search_commitments.js";
import searchKernelsRouter from "./routes/search_kernels.js";
import healthz from "./routes/healthz.js";
import assetsRouter from "./routes/assets.js";

import BackgrounUpdater from "./utils/updater.js";
import { hex, script } from "./script.js";

// Register HBS helpers
hbs.registerHelper("hex", hex);
hbs.registerHelper("script", script);

hbs.registerHelper("timestamp", function (timestamp) {
  const dateObj = new Date(timestamp * 1000);
  const day = dateObj.getUTCDate();
  const month = dateObj.getUTCMonth() + 1;
  const year = dateObj.getUTCFullYear();
  const hours = dateObj.getUTCHours();
  const minutes = dateObj.getUTCMinutes();
  const seconds = dateObj.getSeconds();

  return (
    year.toString() +
    "-" +
    month.toString().padStart(2, "0") +
    "-" +
    day.toString().padStart(2, "0") +
    " " +
    hours.toString().padStart(2, "0") +
    ":" +
    minutes.toString().padStart(2, "0") +
    ":" +
    seconds.toString().padStart(2, "0")
  );
});

hbs.registerHelper("percentbar", function (a, b, c) {
  const total = a + b + c;
  if (total === 0) return ".......... 0% ";
  const percent = (a / total) * 100;
  const barWidth = Math.round(percent / 10);
  const bar = "**********".slice(0, barWidth);
  const space = "..........".slice(0, 10 - barWidth);
  return bar + space + " " + parseInt(percent) + "% ";
});

const transformNumberToFormat = (value, unit, toFixedDecimal) => {
  if (value == null) {
    return value;
  }
  let formatting = (val) => val.toLocaleString("en-US");

  if (toFixedDecimal && typeof toFixedDecimal === "number") {
    formatting = (val) => val.toFixed(toFixedDecimal).toLocaleString("en-US");
  }

  return formatting(transformValueToUnit(value, unit, toFixedDecimal));
};

const transformValueToUnit = (value, unit, toFixedDecimal) => {
  if (value === null || value === undefined) {
    return 0;
  }

  let transformLength = (val) => val;

  if (toFixedDecimal && !isNaN(toFixedDecimal)) {
    const toDecimalPoint = (val) => {
      const factor = Math.pow(10, toFixedDecimal);
      return Math.round(val * factor) / factor;
    };
    transformLength = toDecimalPoint;
  }

  switch (unit) {
    case "kilo":
      return transformLength(value / 1000);
    case "mega":
      return transformLength(value / 1000000);
    case "giga":
      return transformLength(value / 1000000000);
    case "tera":
      return transformLength(value / 1000000000000);
    default:
      return transformLength(value);
  }
};

const getPrefixOfUnit = (unit) => {
  switch (unit) {
    case "kilo":
      return "K";
    case "mega":
      return "M";
    case "giga":
      return "G";
    case "tera":
      return "T";
    default:
      return "";
  }
};

hbs.registerHelper("chart", function (data, height, formatThousands, unitStr) {
  if (data.length > 0) {
    let dataTransformed = data;
    const formatThousandsBool = formatThousands
      ? Boolean(formatThousands) === true
      : false;

    const unitStrBool =
      typeof unitStr === "string" ? Boolean(unitStr) === true : false;

    if (unitStr) {
      dataTransformed = data.map((v) => transformValueToUnit(v, unitStr, 3));
    }

    return asciichart.plot(
      dataTransformed,
      formatThousandsBool
        ? {
            height: height,
            format: (x) => {
              return Math.floor(x).toLocaleString("en-US").padStart(15, "  ");
            },
          }
        : {
            height: height,
            format: unitStrBool
              ? (x) => {
                  const valueStr =
                    x.toFixed(2).toLocaleString("en-US") +
                    ` ${getPrefixOfUnit(unitStr)}H/s`;
                  return valueStr.padStart(12, "  ");
                }
              : undefined,
          },
    );
  } else {
    return "**No data**";
  }
});

hbs.registerHelper("unitFormat", transformNumberToFormat);

hbs.registerHelper("add", function (a, b) {
  return a + b;
});

hbs.registerHelper("format_thousands", function (value) {
  if (value == null) {
    return value;
  }
  return Math.floor(value).toLocaleString("en-US");
});
hbs.registerPartials(path.join(import.meta.dirname, "partials"));

const app = express();

const updater = new BackgrounUpdater();
updater.start();

// view engine setup
app.set("views", path.join(import.meta.dirname, "views"));
app.set("view engine", "hbs");

app.use(favicon(path.join(import.meta.dirname, "public", "favicon.ico")));
app.use(pinoHttp());
app.use(express.json());
app.use(
  express.urlencoded({
    extended: false,
  }),
);
app.use(express.static(path.join(import.meta.dirname, "public")));
app.use(cors());
app.use((req, res, next) => {
  res.locals.backgroundUpdater = updater;
  next();
});

app.use("/", indexRouter);
app.use("/blocks", blocksRouter);
app.use("/block_data", blockDataRouter);
app.use("/assets", assetsRouter);
app.use("/mempool", mempoolRouter);
app.use("/miners", minersRouter);
app.use("/search_commitments", searchCommitmentsRouter);
app.use("/search_kernels", searchKernelsRouter);
app.use("/healthz", healthz);

// catch 404 and forward to error handler
app.use((req, res) => {
  res.status(404).send("Not found");
});

// error handler
app.use(function (err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.err = err;
  res.status(err.status || 500).render("error");
});

export default app;
