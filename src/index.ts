import * as http from "http";

type Method = "HEAD" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
type Params = Record<string, string>;
type QueryString = Record<string, string>;
type Cookie = Record<string, string>;
type ProxyHeaders = Record<string, string>;
type Token = { type: "static"; value: string } | { type: "param"; name: string };

export interface ProxyRequest {
  method: Method;
  headers: ProxyHeaders;
  pathname: string;
  params: Params;
  query: QueryString;
  cookie: Cookie;
  body?: string;
}

export interface ProxyResponse {
  json(data: any, options?: { code?: number; headers?: ProxyHeaders }): ProxyResult;
  send(data: string | null, options?: { code?: number; headers?: ProxyHeaders }): ProxyResult;
}

interface ProxyResult {
  code: number;
  headers: ProxyHeaders;
  body?: string | undefined;
}

export type Handler = (req: ProxyRequest, res: ProxyResponse) => ProxyResult | Promise<ProxyResult>;
export type Middleware = (next: Handler) => Handler;
export type ErrorHandler = (req: ProxyRequest, res: ProxyResponse, error: any) => ProxyResult | Promise<ProxyResult>;

type MiddlewareWithPrefix = { prefix: string; middlewares: Middleware[] };

type Router = {
  method: Method;
  pathname: string;
  tokens: Token[];
  middlewares: Middleware[];
  handler: Handler;
};

type NodeSimpleRouterConfig = {
  extended?: boolean;
  httpOptions?: {
    keepAliveTimeout: number;
    headersTimeout: number;
    maxRequestsPerSocket: number;
  };
};

export class NodeSimpleRouter {
  private config: Required<NodeSimpleRouterConfig>;
  private routes: Router[] = [];
  private middlewareStack: MiddlewareWithPrefix[] = [];
  private ignoreTrailingSlash = true;
  private onErrorHandler: ErrorHandler | null = null;
  private response = buildProxyResponse(200);
  private responseErr = buildProxyResponse(500);

  constructor(config?: NodeSimpleRouterConfig) {
    this.config = {
      extended: config?.extended ?? false,
      httpOptions: {
        keepAliveTimeout: config?.httpOptions?.keepAliveTimeout ?? 5000,
        headersTimeout: config?.httpOptions?.headersTimeout ?? 7000,
        maxRequestsPerSocket: config?.httpOptions?.maxRequestsPerSocket ?? 100,
      },
    };

    if (this.config.extended) {
      this.middlewareStack.push({ prefix: "/", middlewares: [middlewareLoggerPlugin()] });
    }
  }

  onError(errHandler: ErrorHandler) {
    this.onErrorHandler = errHandler;
    return this;
  }

  use(prefixOrMw: string | Middleware, ...middlewares: Middleware[]) {
    if (typeof prefixOrMw === "string") {
      const prefix = normalizePrefix(prefixOrMw, this.ignoreTrailingSlash);
      if (!middlewares.length) {
        throw new Error("At least one middleware required");
      }
      this.middlewareStack.push({ prefix, middlewares });
    } else {
      const list = [prefixOrMw, ...middlewares];
      this.middlewareStack.push({ prefix: "/", middlewares: list });
    }

    this.middlewareStack.sort((a, b) => a.prefix.length - b.prefix.length);
    return this;
  }

  head(path: string, handler: Handler, ...middlewares: Middleware[]) {
    return this.add("HEAD", path, handler, middlewares);
  }
  get(path: string, handler: Handler, ...middlewares: Middleware[]) {
    return this.add("GET", path, handler, middlewares);
  }
  post(path: string, handler: Handler, ...middlewares: Middleware[]) {
    return this.add("POST", path, handler, middlewares);
  }
  put(path: string, handler: Handler, ...middlewares: Middleware[]) {
    return this.add("PUT", path, handler, middlewares);
  }
  patch(path: string, handler: Handler, ...middlewares: Middleware[]) {
    return this.add("PATCH", path, handler, middlewares);
  }
  delete(path: string, handler: Handler, ...middlewares: Middleware[]) {
    return this.add("DELETE", path, handler, middlewares);
  }
  options(path: string, handler: Handler, ...middlewares: Middleware[]) {
    return this.add("OPTIONS", path, handler, middlewares);
  }

  private add(method: Method, path: string, handler: Handler, middlewares: Middleware[]) {
    const pathname = normalizePath(path, this.ignoreTrailingSlash);
    const tokens = tokenize(pathname);
    this.routes.push({ method, pathname, tokens, handler, middlewares });
    return this;
  }

  listen(port: number, callback?: () => void) {
    const server = http.createServer(async (nodeReq, nodeRes) => {
      const request: ProxyRequest = await resolveNodeRequest(nodeReq, this.ignoreTrailingSlash);

      let methodMismatch: Set<Method> | null = null;
      let matchedRoute: Router | null = null;

      try {
        const parts = split(request.pathname);
        for (const route of this.routes) {
          const params = matchTokens(route.tokens, parts);
          if (!params) continue;

          if (route.method !== request.method) {
            methodMismatch ??= new Set();
            methodMismatch.add(route.method);
            continue;
          }

          matchedRoute = route;
          request.params = params;
          break;
        }

        const globalChain = this.middlewareStack
          .filter((mw) => pathnameStartsWith(request.pathname, mw.prefix))
          .flatMap((mw) => mw.middlewares);

        let middlewares: Middleware[] = [];
        let finalHandler: Handler;

        if (matchedRoute) {
          middlewares = [...globalChain, ...matchedRoute.middlewares];
          finalHandler = matchedRoute.handler;
        } else {
          middlewares = globalChain;
          finalHandler = methodMismatch ? notAllowedHandler([...methodMismatch]) : notFoundHandler();
        }

        const handler = composeMiddleware(middlewares, finalHandler);
        const result = await handler(request, this.response);

        if (!nodeRes.writableEnded) {
          nodeRes.writeHead(result.code, result.headers);
          nodeRes.end(result.body);
        }
      } catch (err) {
        if (this.onErrorHandler) {
          const result = await this.onErrorHandler(request, this.responseErr, err);
          if (!nodeRes.writableEnded) {
            nodeRes.writeHead(result.code, result.headers);
            nodeRes.end(result.body);
          }
          return;
        }

        console.error(err);
        if (!nodeRes.writableEnded) {
          const body = JSON.stringify({ message: "Internal Server Error" });
          nodeRes.writeHead(500, { "content-type": "application/json; charset=utf-8" });
          nodeRes.end(body);
        }
      }
    });

    server.keepAliveTimeout = this.config.httpOptions.keepAliveTimeout;
    server.headersTimeout = this.config.httpOptions.headersTimeout;
    server.maxRequestsPerSocket = this.config.httpOptions.maxRequestsPerSocket;

    return server.listen(port, "0.0.0.0", callback);
  }
}

const buildProxyResponse = (defaultCode: number = 200): ProxyResponse => {
  return {
    json(data, options) {
      return {
        code: options?.code || defaultCode,
        headers: { ...options?.headers, "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify(data || {}),
      };
    },
    send(data, options) {
      return {
        code: options?.code || defaultCode,
        headers: { ...options?.headers, "content-type": "text/plain; charset=utf-8" },
        body: data ?? undefined,
      };
    },
  };
};

const composeMiddleware = (middlewares: Middleware[], finalHandler: Handler): Handler => {
  const handler = middlewares.reduceRight((next, middleware) => {
    return middleware(next);
  }, finalHandler);
  return handler;
};

const notFoundHandler = (): Handler => {
  const body = JSON.stringify({ message: "Not Found" });
  return async (req, res) => {
    return {
      code: 404,
      headers: { "content-type": "application/json; charset=utf-8" },
      body,
    };
  };
};

const notAllowedHandler = (methods: Method[]): Handler => {
  const body = JSON.stringify({ message: "Method Not Allowed" });
  return async (req, res) => {
    return {
      code: 405,
      headers: {
        Allow: methods.join(", "),
        "content-type": "application/json; charset=utf-8",
      },
      body,
    };
  };
};

const middlewareLoggerPlugin = (): Middleware => (next) => async (req, res) => {
  const start = new Date();
  const path = `${req.method} ${req.pathname}`;
  const hostname = req.headers["hostname"] || req.headers["host"]?.split(":")[0];

  const upstream = await next(req, res);

  const message = {
    timestamp: start.toISOString(),
    code: upstream.code,
    path: path,
    hostname: hostname || "unknown",
    duration: (Date.now() - start.getTime()).toString(),
  };

  console.log(JSON.stringify(message));

  return upstream;
};

const resolveNodeRequest = async (nodeReq: http.IncomingMessage, ignore: boolean): Promise<ProxyRequest> => {
  const [rawPath, rawQueryString = ""] = (nodeReq.url || "/").split("?");

  const method = (nodeReq.method || "GET").toUpperCase() as Method;
  const headers: ProxyHeaders = nodeReq.headers as Record<string, string>;
  const pathname = normalizePath(rawPath, ignore);
  const params: Params = {};
  const query = parseQueryString(rawQueryString);
  const cookie = parseCookie(nodeReq.headers["cookie"] || "");

  const buffers: Buffer[] = [];
  for await (const chunk of nodeReq) {
    buffers.push(chunk as Buffer);
  }
  const body = Buffer.concat(buffers).toString("utf-8") || undefined;

  return {
    method,
    headers: {
      ...headers,
      "x-real-ip": (nodeReq.headers["x-real-ip"] as string) || (nodeReq.socket.remoteAddress as string),
    },
    pathname,
    params,
    query,
    cookie,
    body,
  };
};

const tokenize = (path: string): Token[] => {
  return split(path).map((part) => {
    if (part.startsWith(":")) {
      const name = part.slice(1);
      if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(`유효하지 않은 파라미터입니다. (${name})`);
      }
      return { type: "param", name };
    }
    return { type: "static", value: part };
  });
};

const split = (pathname: string): string[] =>
  pathname
    .split("/")
    .map((d) => d.trim())
    .filter(Boolean);

const normalizePrefix = (prefix: string, ignore: boolean): string => {
  return normalizePath(prefix.startsWith("/") ? prefix : "/" + prefix, ignore);
};

const normalizePath = (path: string, ignore: boolean): string => {
  if (!path) return "/";
  if (!path.startsWith("/")) path = "/" + path;
  if (ignore && path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
};

const pathnameStartsWith = (pathname: string, prefix: string) => {
  if (prefix === "/") return true;
  if (!pathname.startsWith(prefix)) return false;
  /** /user, /user/:id 세그먼트 기준으로 구분 */
  return pathname.length === prefix.length || pathname[prefix.length] === "/";
};

const matchTokens = (tokens: Token[], parts: string[]): Params | null => {
  if (tokens.length !== parts.length) return null;

  const params: Params = {};
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    const seg = parts[i];
    if (tk.type === "static") {
      if (tk.value !== seg) return null;
    } else {
      params[tk.name] = decodeURIComponent(seg);
    }
  }
  return params;
};

const parseQueryString = (rawQueryString: string): QueryString => {
  const init: QueryString = {};

  if (!rawQueryString) return init;

  return rawQueryString
    .replace(/^\?/, "")
    .split("&")
    .reduce((acc, part) => {
      const [k, v = null] = part.split("=").map((d) => d.trim());
      if (!k || !v) return acc;

      acc[decode(k)] = decode(v);
      return acc;
    }, init);
};

const parseCookie = (rawCookie: string): Cookie => {
  const init: Cookie = {};

  if (!rawCookie) return init;

  return rawCookie.split(";").reduce((acc, part) => {
    const [k, v = null] = part.split("=").map((d) => d.trim());
    if (!k || !v) return acc;

    acc[decode(k)] = decode(v);
    return acc;
  }, init);
};

const decode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
