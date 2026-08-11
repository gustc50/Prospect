import { useEffect, useState } from "react";
import { api, Agent, AgentObjection, Company } from "../lib/api";

const emptyForm = {
  name: "",
  llm_provider: "anthropic" as "anthropic" | "openrouter",
  model: "",
  questions: [] as string[],
  objections: [] as AgentObjection[],
  extra_instructions: "",
};

type FormState = typeof emptyForm;

const MODEL_PLACEHOLDER: Record<string, string> = {
  anthropic: "Ex: claude-sonnet-4-5 (em branco usa o padrão do servidor)",
  openrouter: "Ex: openai/gpt-4o-mini, meta-llama/llama-3.1-70b-instruct...",
};

export default function AgentsPage({ activeCompany }: { activeCompany: Company | null }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new">("new");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    if (!activeCompany) return;
    api
      .listAgents(activeCompany.id)
      .then((list) => {
        setAgents(list);
        if (selectedId === "new" && list.length > 0) {
          setSelectedId(list.find((a) => a.is_default)?.id ?? list[0].id);
        }
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    setSelectedId("new");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany]);

  useEffect(() => {
    if (selectedId === "new") {
      setForm(emptyForm);
      return;
    }
    const agent = agents.find((a) => a.id === selectedId);
    if (agent) {
      setForm({
        name: agent.name,
        llm_provider: agent.llm_provider,
        model: agent.model,
        questions: agent.questions,
        objections: agent.objections,
        extra_instructions: agent.extra_instructions,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, agents]);

  const handleSave = async () => {
    if (!activeCompany) return;
    setError(null);
    setSaving(true);
    try {
      const payload = { ...form, company_id: activeCompany.id };
      if (selectedId === "new") {
        const created = await api.createAgent(payload);
        setSelectedId(created.id);
      } else {
        await api.updateAgent(selectedId, payload);
      }
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async () => {
    if (selectedId === "new") return;
    setError(null);
    try {
      await api.setDefaultAgent(selectedId);
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (selectedId === "new") return;
    if (!confirm("Remover este agente? Conversas que já usaram ele continuam no histórico.")) return;
    setError(null);
    try {
      await api.deleteAgent(selectedId);
      setSelectedId("new");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const updateQuestion = (index: number, value: string) => {
    setForm((f) => ({ ...f, questions: f.questions.map((q, i) => (i === index ? value : q)) }));
  };
  const addQuestion = () => setForm((f) => ({ ...f, questions: [...f.questions, ""] }));
  const removeQuestion = (index: number) =>
    setForm((f) => ({ ...f, questions: f.questions.filter((_, i) => i !== index) }));

  const updateObjection = (index: number, field: keyof AgentObjection, value: string) => {
    setForm((f) => ({
      ...f,
      objections: f.objections.map((o, i) => (i === index ? { ...o, [field]: value } : o)),
    }));
  };
  const addObjection = () =>
    setForm((f) => ({ ...f, objections: [...f.objections, { objection: "", response: "" }] }));
  const removeObjection = (index: number) =>
    setForm((f) => ({ ...f, objections: f.objections.filter((_, i) => i !== index) }));

  const isDefault = selectedId !== "new" && agents.find((a) => a.id === selectedId)?.is_default === 1;

  if (!activeCompany) {
    return (
      <div className="empty-state">
        <h2>Nenhuma empresa ativa</h2>
        <p>Configure uma empresa em "Configurações da empresa" para criar agentes.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Agentes — {activeCompany.name}</h2>
      <p className="muted">
        Cada agente é um roteiro de conversa: perguntas-guia, objeções comuns e como respondê-las, instruções
        extras, e qual LLM externa (Anthropic ou OpenRouter) deve conduzir o papo. Crie quantos precisar — por
        produto, campanha, etc. — e escolha qual usar ao iniciar uma conversa com um lead.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
          <div className="row">
            <label style={{ marginBottom: 0 }}>Agente:</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value === "new" ? "new" : Number(e.target.value))}
              style={{ width: 240 }}
            >
              <option value="new">+ Novo agente</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} {a.is_default ? "(padrão)" : ""}
                </option>
              ))}
            </select>
          </div>
          {selectedId !== "new" && (
            <span className={`pill${isDefault ? " active" : ""}`}>{isDefault ? "Padrão" : "Não é padrão"}</span>
          )}
        </div>

        <div className="form-grid">
          <div className="full">
            <label>Nome do agente *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Ex: Vendas - Plano Premium"
            />
          </div>

          <div>
            <label>Provedor de LLM</label>
            <select
              value={form.llm_provider}
              onChange={(e) => setForm((f) => ({ ...f, llm_provider: e.target.value as "anthropic" | "openrouter" }))}
            >
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="openrouter">OpenRouter</option>
            </select>
          </div>
          <div>
            <label>Modelo</label>
            <input
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              placeholder={MODEL_PLACEHOLDER[form.llm_provider]}
            />
          </div>

          <div className="full">
            <label>Perguntas-guia</label>
            {form.questions.map((q, i) => (
              <div className="row" key={i} style={{ marginBottom: 8 }}>
                <input
                  value={q}
                  onChange={(e) => updateQuestion(i, e.target.value)}
                  placeholder={`Pergunta ${i + 1}`}
                />
                <button type="button" className="danger" onClick={() => removeQuestion(i)}>
                  Remover
                </button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={addQuestion}>
              + Adicionar pergunta
            </button>
          </div>

          <div className="full">
            <label>Objeções comuns e como responder</label>
            {form.objections.map((o, i) => (
              <div key={i} className="row" style={{ marginBottom: 8, alignItems: "flex-start" }}>
                <input
                  value={o.objection}
                  onChange={(e) => updateObjection(i, "objection", e.target.value)}
                  placeholder="Objeção (ex: Está caro)"
                  style={{ flex: 1 }}
                />
                <input
                  value={o.response}
                  onChange={(e) => updateObjection(i, "response", e.target.value)}
                  placeholder="Resposta sugerida"
                  style={{ flex: 2 }}
                />
                <button type="button" className="danger" onClick={() => removeObjection(i)}>
                  Remover
                </button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={addObjection}>
              + Adicionar objeção
            </button>
          </div>

          <div className="full">
            <label>Instruções adicionais</label>
            <textarea
              value={form.extra_instructions}
              onChange={(e) => setForm((f) => ({ ...f, extra_instructions: e.target.value }))}
              placeholder="Qualquer outra orientação para este agente seguir na conversa"
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 20 }}>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {selectedId === "new" ? "Criar agente" : "Salvar alterações"}
          </button>
          {selectedId !== "new" && !isDefault && (
            <button className="secondary" onClick={handleSetDefault}>
              Definir como padrão
            </button>
          )}
          {selectedId !== "new" && (
            <button className="danger" onClick={handleDelete}>
              Excluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
