import { ProxyRequest, ProxyResponse, ProxyResult, Method } from "./proxy.js";

export type Context = { traceId: string; requestAt: number };

export type Handler = (req: ProxyRequest, res: ProxyResponse, context: Context) => ProxyResult | Promise<ProxyResult>;
export type Middleware = (next: Handler) => Handler;

export type ErrorHandler = (
  req: ProxyRequest,
  res: ProxyResponse,
  error: any,
  context: Context,
) => ProxyResult | Promise<ProxyResult>;
export type ErrorMiddleware = (next: ErrorHandler) => ErrorHandler;

export type MiddlewareWithPrefix = { prefix: string; middlewares: Middleware[] };

export type Token = { type: "static"; value: string } | { type: "param"; name: string };

export type Router = {
  method: Method;
  pathname: string;
  tokens: Token[];
  middlewares: Middleware[];
  handler: Handler;
};
