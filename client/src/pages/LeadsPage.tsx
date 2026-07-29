import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, Company, Lead } from "../lib/api";

const emptyLead = { name: "", phone: "", email: "", source: "" };

export default function LeadsPage({ activeCompany }: { activeCompany: Company | null }) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [form, setForm] = useState(emptyLead);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    if (!activeCompany) return;
    api
      .listLeads(activeCompany.id)
      .then(setLeads)
      .catch((e) => setError(e.message));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany]);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompany) return;
    setError(null);
    setCreating(true);
    try {
      await api.createLead({ ...form, company_id: activeCompany.id });
      setForm(emptyLead);
      load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const openConversation = async (leadId: number) => {
    const existing = await api.listConversations(leadId);
    const conversation = existing[0] || (await api.createConversation(leadId));
    navigate(`/conversas/${conversation.id}`);
  };

  if (!activeCompany) {
    return (
      <div className="empty-state">
        <h2>Nenhuma empresa ativa</h2>
        <p>Configure uma empresa em "Configurações da empresa" para começar a prospectar.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Leads — {activeCompany.name}</h2>
      {error && <div className="error-banner">{error}</div>}

      <div className="card">
        <form onSubmit={handleAddLead} className="form-grid">
          <div>
            <label>Nome *</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label>Telefone</label>
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          </div>
          <div>
            <label>E-mail</label>
            <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label>Origem</label>
            <input
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              placeholder="Ex: site, indicação, evento..."
            />
          </div>
          <div className="full">
            <button type="submit" disabled={creating || !form.name.trim()}>
              Adicionar lead
            </button>
          </div>
        </form>
      </div>

      {leads.length === 0 ? (
        <div className="empty-state">Nenhum lead cadastrado ainda.</div>
      ) : (
        leads.map((lead) => (
          <div className="list-item" key={lead.id}>
            <div>
              <strong>{lead.name}</strong>
              <div className="muted">
                {[lead.phone, lead.email, lead.source].filter(Boolean).join(" · ") || "sem detalhes"}
              </div>
            </div>
            <div className="row">
              <span className="pill">{lead.status}</span>
              <button onClick={() => openConversation(lead.id)}>Conversar</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
