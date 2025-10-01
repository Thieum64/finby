const express = require("express");
const app = express();
app.use((req, _res, next) => {
  console.log("REQ", req.method, req.url);
  next();
});
app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "svc-authz" });
});
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "svc-authz" });
});
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "svc-authz", endpoint: "root" });
});
app.all("*", (_req, res) => {
  res.json({ ok: true, service: "svc-authz", endpoint: "catchall" });
});
const port = process.env.PORT || 8080;
app.listen(port, () => console.log("svc-authz v6 listening on", port));
