import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { api, Company } from "./lib/api";
import SettingsPage from "./pages/SettingsPage";
import LeadsPage from "./pages/LeadsPage";
import ConversationPage from "./pages/ConversationPage";

export default function App() {
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const reloadActiveCompany = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    api
      .listCompanies()
      .then((companies) => setActiveCompany(companies.find((c) => c.is_active) || null))
      .catch(() => setActiveCompany(null));
  }, [refreshKey]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Prospect</h1>
        <div className="company-badge">
          {activeCompany ? (
            <>
              Trabalhando para:
              <br />
              <strong>{activeCompany.name}</strong>
            </>
          ) : (
            "Nenhuma empresa ativa configurada"
          )}
        </div>
        <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Leads
        </NavLink>
        <NavLink to="/configuracoes" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          Configurações da empresa
        </NavLink>
      </aside>
      <main className="main">
        <Routes>
          <Route path="/" element={<LeadsPage activeCompany={activeCompany} />} />
          <Route path="/configuracoes" element={<SettingsPage onCompanyChange={reloadActiveCompany} />} />
          <Route path="/conversas/:conversationId" element={<ConversationPage />} />
        </Routes>
      </main>
    </div>
  );
}
