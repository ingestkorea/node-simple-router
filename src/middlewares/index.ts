import { Middleware } from "../models/router.js";
import { IK_TRACE_ID } from "../constants.js";

export const middlewareTraceId: Middleware = (next) => async (req, res, context) => {
  req.headers[IK_TRACE_ID] = context.traceId;

  const upstream = await next(req, res, context);

  upstream.headers[IK_TRACE_ID] = context.traceId;

  return upstream;
};

export const middlewareLoggerPlugin = (): Middleware => (next) => async (req, res, context) => {
  const start = Date.now();
  const path = `${req.method} ${req.pathname}`;
  const hostname = req.headers["hostname"] || req.headers["host"]?.split(":")[0];

  const upstream = await next(req, res, context);

  const message = {
    timestamp: new Date(start).toISOString(),
    code: upstream.code,
    path: path,
    hostname: hostname || "unknown",
    traceId: context.traceId,
    duration: Date.now() - start,
  };

  console.log(JSON.stringify(message));

  return upstream;
};
