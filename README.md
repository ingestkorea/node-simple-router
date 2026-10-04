# @ingestkorea/node-simple-router

[![npm (scoped)](https://img.shields.io/npm/v/@ingestkorea/node-simple-router?style=flat-square)](https://www.npmjs.com/package/@ingestkorea/node-simple-router)
[![npm downloads](https://img.shields.io/npm/dm/@ingestkorea/node-simple-router?style=flat-square)](https://www.npmjs.com/package/@ingestkorea/node-simple-router)

## Description

Ultra-lightweight, zero-dependency native HTTP router for Node.js built with pure functional middleware.

## Install

```sh
npm install @ingestkorea/node-simple-router
```

```ts
import { NodeSimpleRouter, Middleware, Result } from "@ingestkorea/node-simple-router";

const port = 3000;
const app = new NodeSimpleRouter({
  debug: true, // default false
  // extended: true, // deprecated
});

const middlewareHealth: Middleware = (next) => async (req, res, context) => {
  if (req.method == "HEAD") {
    return res.send(null);
  }

  return next(req, res, context);
};

// Middleware
app.use("/", middlewareHealth);

// API Server
type MyAPIResponse = Result<{ data: string }>;

app.get("/", (req, res, context) => {
  const content: MyAPIResponse = { ok: true, data: "hello world" };
  return res.json(content);
});

app.get("/users/:userId", (req, res, context) => {
  const userId = req.params["userId"];
  const content: MyAPIResponse = { ok: true, data: `userid: ${userId}` };
  return res.json(content);
});

app.get("/error", (req, res) => {
  throw new Error("error test");
});

app.onError((req, res, err, context) => {
  const message = JSON.stringify({
    timestamp: new Date().toISOString(),
    traceId: context.traceId,
    message: err instanceof Error ? err.message : String(err),
  });
  console.error(message);

  const body: MyAPIResponse = { ok: false, message: "something wrong" };
  return res.json(body, { code: 400 });
});

app.listen(port, () => {
  const message = JSON.stringify({
    timestamp: new Date().toISOString(),
    port: port,
    message: "server start",
  });
  console.log(message);
});
```

## Test

```sh
curl -i http://localhost:3000

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
...
x-ik-trace-id: 86fc62fd8d1d44f7befe9319c26a7436

{"ok":true,"data":"hello world"}
```

```sh
{"timestamp":"2026-10-03T12:23:33.534Z","code":200,"path":"GET /","hostname":"localhost","traceId":"86fc62fd8d1d44f7befe9319c26a7436","duration":"0"}
```

```sh
curl -i http://localhost:3000/users/12345

HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
...
x-ik-trace-id: b67687f2219e488587cf1883d12590c1

{"ok":true,"data":"userid: 12345"}
```

```sh
{"timestamp":"2026-10-03T12:25:19.216Z","code":200,"path":"GET /users/12345","hostname":"localhost","traceId":"b67687f2219e488587cf1883d12590c1","duration":"1"}
```

```sh
curl -i http://localhost:3000/error

HTTP/1.1 400 Bad Request
content-type: application/json; charset=utf-8
...
x-ik-trace-id: baade51119824555bdbd1cda04ad76e6

{"ok":false,"message":"something wrong"}
```

```sh
{"timestamp":"2026-10-03T12:28:43.195Z","traceId":"baade51119824555bdbd1cda04ad76e6","message":"error test"}
```
