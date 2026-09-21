# @ingestkorea/node-simple-router

[![npm (scoped)](https://img.shields.io/npm/v/@ingestkorea/node-simple-router?style=flat-square)](https://www.npmjs.com/package/@ingestkorea/node-simple-router)
[![npm downloads](https://img.shields.io/npm/dm/@ingestkorea/node-simple-router?style=flat-square)](https://www.npmjs.com/package/@ingestkorea/node-simple-router)

## Description

Only 13K ultra-lightweight, zero-dependency native HTTP router for Node.js built with pure functional middleware.

## Install

```sh
npm install @ingestkorea/node-simple-router
```

```ts
import { NodeSimpleRouter, Middleware } from "@ingestkorea/node-simple-router";

const port = 3000;
const app = new NodeSimpleRouter({
  extended: true, // optional
});

const middlewareHealth: Middleware = (next) => async (req, res) => {
  if (req.method == "HEAD") {
    return res.send(null);
  }
  return next(req, res);
};

app.use("/", middlewareHealth);

apapp.get("/", (req, res) => {
  return res.json({ ok: true });
});

app.get("/error", (req, res) => {
  throw new Error("error test");
});

app.onError((req, res, err) => {
  const message = JSON.stringify({
    timestamp: new Date().toISOString(),
    code: 500,
    path: `${req.method} ${req.pathname}`,
    message: err instanceof Error ? err.stack : String(err),
  });
  console.error(message);

  const body = { ok: false, message: "something wrong" };
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
