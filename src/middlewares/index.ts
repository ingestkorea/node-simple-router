import { Middleware, ErrorMiddleware } from "../models/router.js";
import { IK_TRACE_ID, IK_REQUEST_AT } from "../constants.js";

export const middlewareErrorTraceId: ErrorMiddleware = (next) => async (req, res, err, context) => {
  const requestAt = context.requestAt.toString();

  req.headers[IK_TRACE_ID] = context.traceId;
  req.headers[IK_REQUEST_AT] = requestAt;

  const upstream = await next(req, res, err, context);

  upstream.headers[IK_TRACE_ID] = context.traceId;
  upstream.headers[IK_REQUEST_AT] = requestAt;

  return upstream;
};

export const middlewareTraceId: Middleware = (next) => async (req, res, context) => {
  const requestAt = context.requestAt.toString();

  req.headers[IK_TRACE_ID] = context.traceId;
  req.headers[IK_REQUEST_AT] = requestAt;

  const upstream = await next(req, res, context);

  upstream.headers[IK_TRACE_ID] = context.traceId;
  upstream.headers[IK_REQUEST_AT] = requestAt;

  return upstream;
};

export const middlewareLoggerPlugin = (): Middleware => (next) => async (req, res, context) => {
  const path = `${req.method} ${req.pathname}`;
  const hostname = req.headers["hostname"] || req.headers["host"]?.split(":")[0];

  const upstream = await next(req, res, context);
  const isSuccess = upstream.code < 300 ? true : false;

  const message = JSON.stringify({
    timestamp: new Date(context.requestAt).toISOString(),
    traceId: context.traceId,
    code: upstream.code,
    path: path,
    hostname: hostname || "unknown",
    ...(!isSuccess && { body: upstream.body || "-" }),
    duration: Date.now() - context.requestAt,
  });

  if (isSuccess) {
    console.log(message);
  } else {
    console.error(message);
  }

  return upstream;
};
