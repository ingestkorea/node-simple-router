export type Method = "HEAD" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
export type Headers = Record<string, string>;
export type Params = Record<string, string>;
export type QueryString = Record<string, string>;
export type Cookie = Record<string, string>;

export interface ProxyRequest {
  method: Method;
  headers: Headers;
  pathname: string;
  params: Params;
  query: QueryString;
  cookie: Cookie;
  body?: string;
}

export interface ProxyResponse {
  json(data: any, options?: { code?: number; headers?: Headers }): ProxyResult;
  send(data: string | null, options?: { code?: number; headers?: Headers }): ProxyResult;
}

export interface ProxyResult {
  code: number;
  headers: Headers;
  body?: string | undefined;
}
