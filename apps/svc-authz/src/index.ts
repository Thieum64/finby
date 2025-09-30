import express from "express";

const app = express();

app.get("/healthz", (_req, res) => {
  res.json({ ok: true, service: "svc-authz" });
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`svc-authz listening on port ${port}`);
});
