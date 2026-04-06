import React, { useState, useEffect } from "react";
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Link, 
  useNavigate,
  Navigate
} from "react-router-dom";
import { 
  LayoutDashboard, 
  Calendar as CalendarIcon, 
  BarChart3, 
  Settings, 
  LogOut,
  Stethoscope,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth } from "./firebase";
import Dashboard from "./components/Dashboard";
import ArticleEditor from "./components/ArticleEditor";
import Calendar from "./components/Calendar";
import StatsDashboard from "./components/StatsDashboard";
import { fetchPubMedArticles, fetchRSSArticles, saveArticles, seedTestData, fetchClinicalTrials, fetchEuropePMC, fetchOpenAlex, fetchBioRxiv, fetchOpenFDA, fetchChEMBL, fetchOrphanet } from "./services/collectorService";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      const [pubmed, trials, epmc, openalex, biorxiv, medrxiv, fda, chembl, orphanet] = await Promise.all([
        fetchPubMedArticles(),
        fetchClinicalTrials(),
        fetchEuropePMC(),
        fetchOpenAlex(),
        fetchBioRxiv("biorxiv"),
        fetchBioRxiv("medrxiv"),
        fetchOpenFDA(),
        fetchChEMBL(),
        fetchOrphanet()
      ]);
      
      const rssSources = [
        { url: "https://www.ema.europa.eu/en/news.xml", name: "ema_rss" },
        { url: "https://www.fda.gov/news-events/press-announcements/rss.xml", name: "fda_rss" },
        { url: "https://www.nejm.org/rss/recent-articles", name: "nejm_rss" },
        { url: "https://www.thelancet.com/rssfeed/lancet_current.xml", name: "lancet_rss" },
        { url: "https://www.nature.com/nm.rss", name: "nature_med_rss" },
        { url: "https://journals.plos.org/plosntds/feed/atom", name: "plos_ntd_rss" },
        { url: "https://malariajournal.biomedcentral.com/articles/rss", name: "malaria_journal_rss" }
      ];

      const rssArticles = await Promise.all(
        rssSources.map(s => fetchRSSArticles(s.url, s.name))
      );
      
      const allArticles = [
        ...pubmed, 
        ...trials, 
        ...epmc, 
        ...openalex,
        ...biorxiv,
        ...medrxiv,
        ...fda,
        ...chembl,
        ...orphanet,
        ...rssArticles.flat()
      ];
      
      await saveArticles(allArticles);
      alert("Données rafraîchies avec succès !");
    } catch (error) {
      console.error("Refresh failed", error);
      alert("Erreur lors du rafraîchissement des données.");
    } finally {
      setIsRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
          <div className="bg-blue-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <Stethoscope className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">MedWatch AI</h1>
          <p className="text-slate-600 mb-8">
            Veille médicale intelligente et community management automatisé.
          </p>
          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            Se connecter avec Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
          <div className="p-6 flex items-center gap-3 border-b border-slate-100">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <span className="font-bold text-xl text-slate-900">MedWatch</span>
          </div>
          
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <NavLink to="/dashboard" icon={<LayoutDashboard size={20} />} label="Dashboard" />
            <NavLink to="/calendar" icon={<CalendarIcon size={20} />} label="Calendrier" />
            <NavLink to="/stats" icon={<BarChart3 size={20} />} label="Statistiques" />
          </nav>

          <div className="p-4 border-t border-slate-100 space-y-2">
            <button
              onClick={handleRefreshData}
              disabled={isRefreshing}
              className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
              <span>Rafraîchir</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
            >
              <LogOut size={20} />
              <span>Déconnexion</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/editor/:id" element={<ArticleEditor />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/stats" element={<StatsDashboard />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all font-medium"
    >
      {icon}
      {label}
    </Link>
  );
}
