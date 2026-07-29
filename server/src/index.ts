import "dotenv/config";
import express from "express";
import cors from "cors";
import companiesRouter from "./routes/companies";
import leadsRouter from "./routes/leads";
import conversationsRouter from "./routes/conversations";
import "./db";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, llmConfigured: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.use("/api/companies", companiesRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/conversations", conversationsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Erro interno do servidor." });
});

app.listen(PORT, () => {
  console.log(`Prospect API rodando em http://localhost:${PORT}`);
});
