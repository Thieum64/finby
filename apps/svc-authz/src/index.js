const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.json({ message: "svc-authz root", timestamp: new Date().toISOString() });
});

app.get("/healthz", (req, res) => {
  res.json({ ok: true, service: "svc-authz", timestamp: new Date().toISOString() });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`svc-authz listening on port ${port}`);
});
