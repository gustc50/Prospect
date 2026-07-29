import { Router } from "express";
import { CompatDb } from "../db";

const FIELDS = [
  "name",
  "segment",
  "description",
  "products_services",
  "differentials",
  "target_audience",
  "tone_of_voice",
  "website",
  "contact_info",
  "qualification_criteria",
  "goal",
];

export default function createCompaniesRouter(db: CompatDb) {
  const router = Router();

  router.get("/", (_req, res) => {
    const companies = db
      .prepare("SELECT * FROM companies ORDER BY is_active DESC, created_at DESC")
      .all();
    res.json(companies);
  });

  router.get("/active", (_req, res) => {
    const company = db.prepare("SELECT * FROM companies WHERE is_active = 1").get();
    if (!company) return res.status(404).json({ error: "Nenhuma empresa ativa configurada." });
    res.json(company);
  });

  router.get("/:id", (req, res) => {
    const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
    if (!company) return res.status(404).json({ error: "Empresa não encontrada." });
    res.json(company);
  });

  router.post("/", (req, res) => {
    const body = req.body || {};
    if (!body.name || !String(body.name).trim()) {
      return res.status(400).json({ error: "O nome da empresa é obrigatório." });
    }

    const existingCount = (db.prepare("SELECT COUNT(*) as c FROM companies").get() as { c: number }).c;
    const makeActive = existingCount === 0 ? 1 : 0;

    const providedFields = FIELDS.filter((f) => body[f] !== undefined);
    const columns = providedFields.join(", ");
    const placeholders = providedFields.map((f) => `@${f}`).join(", ");
    const params: Record<string, string> = {};
    for (const f of providedFields) params[f] = body[f];

    const insertSql = providedFields.length
      ? `INSERT INTO companies (${columns}, is_active) VALUES (${placeholders}, ${makeActive})`
      : `INSERT INTO companies (is_active) VALUES (${makeActive})`;

    const info = db.prepare(insertSql).run(params);

    const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(company);
  });

  router.put("/:id", (req, res) => {
    const body = req.body || {};
    const existing = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Empresa não encontrada." });

    if (body.name !== undefined && !String(body.name).trim()) {
      return res.status(400).json({ error: "O nome da empresa é obrigatório." });
    }

    const setClauses = FIELDS.filter((f) => body[f] !== undefined)
      .map((f) => `${f} = @${f}`)
      .join(", ");

    const params: Record<string, string | number> = { id: req.params.id };
    for (const f of FIELDS) {
      if (body[f] !== undefined) params[f] = body[f];
    }

    if (setClauses) {
      db.prepare(`UPDATE companies SET ${setClauses}, updated_at = datetime('now') WHERE id = @id`).run(params);
    }

    const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
    res.json(company);
  });

  router.post("/:id/activate", (req, res) => {
    const existing = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Empresa não encontrada." });

    const activate = db.transaction((id: string) => {
      db.prepare("UPDATE companies SET is_active = 0").run();
      db.prepare("UPDATE companies SET is_active = 1, updated_at = datetime('now') WHERE id = ?").run(id);
    });
    activate(req.params.id);

    const company = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
    res.json(company);
  });

  router.delete("/:id", (req, res) => {
    const existing = db.prepare("SELECT * FROM companies WHERE id = ?").get(req.params.id);
    if (!existing) return res.status(404).json({ error: "Empresa não encontrada." });

    db.prepare("DELETE FROM companies WHERE id = ?").run(req.params.id);
    res.status(204).send();
  });

  return router;
}
