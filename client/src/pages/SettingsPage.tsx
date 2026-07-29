import { useEffect, useState } from "react";
import { api, Company } from "../lib/api";

const emptyForm = {
  name: "",
  segment: "",
  description: "",
  products_services: "",
  differentials: "",
  target_audience: "",
  tone_of_voice: "consultivo e cordial",
  website: "",
  contact_info: "",
  qualification_criteria: "",
  goal: "Agendar uma reunião de apresentação com o lead qualificado.",
};

type FormState = typeof emptyForm;

export default function SettingsPage({ onCompanyChange }: { onCompanyChange: () => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState<number | "new">("new");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    api
      .listCompanies()
      .then((list) => {
        setCompanies(list);
        if (selectedId === "new" && list.length > 0) {
          const active = list.find((c) => c.is_active) || list[0];
          setSelectedId(active.id);
        }
      })
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId === "new") {
      setForm(emptyForm);
      return;
    }
    const company = companies.find((c) => c.id === selectedId);
    if (company) {
      setForm({
        name: company.name,
        segment: company.segment,
        description: company.description,
        products_services: company.products_services,
        differentials: company.differentials,
        target_audience: company.target_audience,
        tone_of_voice: company.tone_of_voice,
        website: company.website,
        contact_info: company.contact_info,
        qualification_criteria: company.qualification_criteria,
        goal: company.goal,
      });
    }
  }, [selectedId, companies]);

  const update = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    try {
      if (selectedId === "new") {
        const created = await api.createCompany(form);
        setSelectedId(created.id);
      } else {
        await api.updateCompany(selectedId, form);
      }
      load();
      onCompanyChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async () => {
    if (selectedId === "new") return;
    setError(null);
    try {
      await api.activateCompany(selectedId);
      load();
      onCompanyChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async () => {
    if (selectedId === "new") return;
    if (!confirm("Remover esta empresa e todos os seus leads/conversas?")) return;
    setError(null);
    try {
      await api.deleteCompany(selectedId);
      setSelectedId("new");
      load();
      onCompanyChange();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const isActive = selectedId !== "new" && companies.find((c) => c.id === selectedId)?.is_active === 1;

  return (
    <div>
      <h2>Configurações da empresa</h2>
      <p className="muted">
        Estas informações são usadas pela LLM para saber exatamente qual empresa ela está representando durante
        as conversas de prospecção. Apenas uma empresa fica <strong>ativa</strong> por vez — é ela que o sistema
        usa para responder novos leads.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <div className="row" style={{ marginBottom: 16, justifyContent: "space-between" }}>
          <div className="row">
            <label style={{ marginBottom: 0 }}>Empresa:</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value === "new" ? "new" : Number(e.target.value))}
              style={{ width: 240 }}
            >
              <option value="new">+ Nova empresa</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.is_active ? "(ativa)" : ""}
                </option>
              ))}
            </select>
          </div>
          {selectedId !== "new" && (
            <span className={`pill${isActive ? " active" : ""}`}>{isActive ? "Empresa ativa" : "Inativa"}</span>
          )}
        </div>

        <div className="form-grid">
          <div className="full">
            <label>Nome da empresa *</label>
            <input value={form.name} onChange={update("name")} placeholder="Ex: Acme Soluções Ltda" />
          </div>

          <div>
            <label>Segmento / setor</label>
            <input value={form.segment} onChange={update("segment")} placeholder="Ex: SaaS de gestão financeira" />
          </div>
          <div>
            <label>Site</label>
            <input value={form.website} onChange={update("website")} placeholder="https://..." />
          </div>

          <div className="full">
            <label>Descrição da empresa</label>
            <textarea
              value={form.description}
              onChange={update("description")}
              placeholder="O que a empresa faz, missão, história curta..."
            />
          </div>

          <div className="full">
            <label>Produtos / serviços</label>
            <textarea
              value={form.products_services}
              onChange={update("products_services")}
              placeholder="Liste os principais produtos/serviços oferecidos"
            />
          </div>

          <div className="full">
            <label>Diferenciais competitivos</label>
            <textarea
              value={form.differentials}
              onChange={update("differentials")}
              placeholder="O que torna a empresa diferente da concorrência"
            />
          </div>

          <div>
            <label>Público-alvo</label>
            <textarea
              value={form.target_audience}
              onChange={update("target_audience")}
              placeholder="Perfil de cliente ideal"
            />
          </div>
          <div>
            <label>Tom de voz</label>
            <input
              value={form.tone_of_voice}
              onChange={update("tone_of_voice")}
              placeholder="Ex: consultivo, descontraído, formal..."
            />
          </div>

          <div className="full">
            <label>Critérios de qualificação do lead</label>
            <textarea
              value={form.qualification_criteria}
              onChange={update("qualification_criteria")}
              placeholder="Como a LLM deve identificar se um lead está qualificado"
            />
          </div>

          <div className="full">
            <label>Objetivo da conversa</label>
            <textarea
              value={form.goal}
              onChange={update("goal")}
              placeholder="Ex: Agendar uma demonstração / Coletar orçamento e enviar proposta"
            />
          </div>

          <div className="full">
            <label>Contato para transferência humana</label>
            <input
              value={form.contact_info}
              onChange={update("contact_info")}
              placeholder="E-mail, telefone ou WhatsApp do time comercial"
            />
          </div>
        </div>

        <div className="row" style={{ marginTop: 20 }}>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}>
            {selectedId === "new" ? "Criar empresa" : "Salvar alterações"}
          </button>
          {selectedId !== "new" && !isActive && (
            <button className="secondary" onClick={handleActivate}>
              Ativar como empresa atual
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
