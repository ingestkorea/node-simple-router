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
import { NodeSimpleRouter } from "@ingestkorea/node-simple-router";

const port = 3000;
const app = new NodeSimpleRouter();

app.use("/", (next) => async (req, res) => {
  if (req.method == "HEAD") {
    return res.send(null);
  }

  return next(req, res);
});

app.get("/", (req, res) => {
  return res.json(req);
});

app.onError((req, res, err) => {
  console.error(`[error]: ${req.method} ${req.pathname} - ${(err as any)?.message || String(err)}`);
  return res.json({ message: "something wrong" }, { code: 400 });
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
```
