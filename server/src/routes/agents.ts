import { Router } from "express";
import { CompatDb } from "../db";

interface AgentRow {
  id: number;
  company_id: number;
  name: string;
  llm_provider: string;
  model: string;
  questions: string;
  objections: string;
  extra_instructions: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function serialize(row: AgentRow) {
  let questions: string[] = [];
  let objections: { objection: string; response: string }[] = [];
  try {
    questions = JSON.parse(row.questions || "[]");
  } catch {
    questions = [];
  }
  try {
    objections = JSON.parse(row.objections || "[]");
  } catch {
    objections = [];
  }
  return { ...row, questions, objections };
}

function sanitizeQuestions(input: unknown): string {
  if (!Array.isArray(input)) return "[]";
  const cleaned = input
    .map((q) => String(q ?? "").trim())
    .filter((q) => q.length > 0);
  return JSON.stringify(cleaned);
}

function sanitizeObjections(input: unknown): string {
  if (!Array.isArray(input)) return "[]";
  const cleaned = input
    .map((o) => ({
      objection: String((o as any)?.objection ?? "").trim(),
      response: String((o as any)?.response ?? "").trim(),
    }))
    .filter((o) => o.objection.length > 0 || o.response.length > 0);
  return JSON.stringify(cleaned);
}

const VALID_PROVIDERS = ["anthropic", "openrouter"];

export default function createAgentsRouter(db: CompatDb) {
  const router = Router();

  router.get("/", (req, res) => {
    const companyId = req.query.company_id;
    const agents = (
      companyId
        ? db.prepare("SELECT * FROM agents WHERE company_id = ? ORDER BY is_default DESC, created_at DESC").all(companyId)
        : db.prepare("SELECT * FROM agents ORDER BY is_default DESC, created_at DESC").all()
    ) as AgentRow[];
    res.json(agents.map(serialize));
  });

  router.get("/:id", (req, res) => {
    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id) as AgentRow | undefined;
    if (!agent) return res.status(404).json({ error: "Agente não encontrado." });
    res.json(serialize(agent));
  });

  router.post("/", (req, res) => {
    const body = req.body || {};
    const { company_id, name, llm_provider, model, questions, objections, extra_instructions } = body;

    if (!company_id) return res.status(400).json({ error: "company_id é obrigatório." });
    if (!name || !String(name).trim()) return res.status(400).json({ error: "O nome do agente é obrigatório." });

    const provider = VALID_PROVIDERS.includes(llm_provider) ? llm_provider : "anthropic";

    const company = db.prepare("SELECT id FROM companies WHERE id = ?").get(company_id);
    if (!company) return res.status(400).json({ error: "Empresa informada não existe." });

    const existingCount = (
      db.prepare("SELECT COUNT(*) as c FROM agents WHERE company_id = ?").get(company_id) as { c: number }
    ).c;
    const makeDefault = existingCount === 0 ? 1 : 0;

    const info = db
      .prepare(
        `INSERT INTO agents (company_id, name, llm_provider, model, questions, objections, extra_instructions, is_default)
         VALUES (@company_id, @name, @llm_provider, @model, @questions, @objections, @extra_instructions, @is_default)`
      )
      .run({
        company_id,
        name,
        llm_provider: provider,
        model: model ?? "",
        questions: sanitizeQuestions(questions),
        objections: sanitizeObjections(objections),
        extra_instructions: extra_instructions ?? "",
        is_default: makeDefault,
      });

    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(info.lastInsertRowid) as AgentRow;
    res.status(201).json(serialize(agent));
  });

  router.put("/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id) as AgentRow | undefined;
    if (!existing) return res.status(404).json({ error: "Agente não encontrado." });

    const body = req.body || {};
    if (body.name !== undefined && !String(body.name).trim()) {
      return res.status(400).json({ error: "O nome do agente é obrigatório." });
    }

    const params: Record<string, string | number> = { id: req.params.id };
    const setClauses: string[] = [];

    if (body.name !== undefined) {
      setClauses.push("name = @name");
      params.name = body.name;
    }
    if (body.llm_provider !== undefined) {
      setClauses.push("llm_provider = @llm_provider");
      params.llm_provider = VALID_PROVIDERS.includes(body.llm_provider) ? body.llm_provider : "anthropic";
    }
    if (body.model !== undefined) {
      setClauses.push("model = @model");
      params.model = body.model;
    }
    if (body.questions !== undefined) {
      setClauses.push("questions = @questions");
      params.questions = sanitizeQuestions(body.questions);
    }
    if (body.objections !== undefined) {
      setClauses.push("objections = @objections");
      params.objections = sanitizeObjections(body.objections);
    }
    if (body.extra_instructions !== undefined) {
      setClauses.push("extra_instructions = @extra_instructions");
      params.extra_instructions = body.extra_instructions;
    }

    if (setClauses.length) {
      db.prepare(`UPDATE agents SET ${setClauses.join(", ")}, updated_at = datetime('now') WHERE id = @id`).run(params);
    }

    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id) as AgentRow;
    res.json(serialize(agent));
  });

  router.post("/:id/default", (req, res) => {
    const existing = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id) as AgentRow | undefined;
    if (!existing) return res.status(404).json({ error: "Agente não encontrado." });

    const setDefault = db.transaction((id: string, companyId: number) => {
      db.prepare("UPDATE agents SET is_default = 0 WHERE company_id = ?").run(companyId);
      db.prepare("UPDATE agents SET is_default = 1, updated_at = datetime('now') WHERE id = ?").run(id);
    });
    setDefault(req.params.id, existing.company_id);

    const agent = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id) as AgentRow;
    res.json(serialize(agent));
  });

  router.delete("/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM agents WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Agente não encontrado." });

    db.prepare("DELETE FROM agents WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  return router;
}
