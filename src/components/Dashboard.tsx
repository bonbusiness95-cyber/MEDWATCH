import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { Edit2, XCircle, ExternalLink, BrainCircuit, Filter, X, Menu, LayoutDashboard, Calendar as CalendarIcon, BarChart3, Settings, LogOut, RefreshCw, Stethoscope } from "lucide-react";
import { fetchAllAPISources, fetchAllRSSSources, fetchAllScrapeSources, fetchPubMedArticles } from "../services/collectorService";
import { analyzeArticle } from "../services/geminiService";
import { allSources } from "../services/sourceConfig";

export default function Dashboard() {
  const [articles, setArticles] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");
  const [sourcefilters, setSourceFilters] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "api" | "rss" | "scrape">("all");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [showSourcePanel, setShowSourcePanel] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let q = query(
      collection(db, "articles"),
      where("status", "==", filter),
      orderBy("created_at", "desc")
    );

    if (sourcefilters.length > 0) {
      q = query(q, where("source", "in", sourcefilters));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setArticles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return unsubscribe;
  }, [filter, sourcefilters]);

  const handleAnalyze = async (article: any) => {
    setAnalyzingId(article.id);
    try {
      const analysis = await analyzeArticle({ title: article.title, abstract: article.abstract });
      await updateDoc(doc(db, "articles", article.id), {
        ...analysis,
        status: "pending" // Keep pending but with analysis
      });
      alert("Analyse terminée !");
    } catch (error) {
      console.error("Analysis failed", error);
      alert("L'analyse a échoué.");
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleReject = async (id: string) => {
    if (confirm("Voulez-vous vraiment rejeter cet article ?")) {
      await updateDoc(doc(db, "articles", id), { status: "rejected" });
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      const [apiArticles, rssArticles, scrapeArticles, pubmedArticles] = await Promise.all([
        fetchAllAPISources(),
        fetchAllRSSSources(),
        fetchAllScrapeSources(),
        fetchPubMedArticles()
      ]);

      const allArticles = [
        ...apiArticles,
        ...rssArticles,
        ...scrapeArticles,
        ...pubmedArticles
      ];

      console.log(`Fetched ${allArticles.length} articles from all sources`);
      alert(`✅ Données rafraîchies! ${allArticles.length} articles collectés.`);
    } catch (error) {
      console.error("Refresh failed", error);
      alert("Erreur lors du rafraîchissement des données.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const toggleSourceFilter = (sourceName: string) => {
    setSourceFilters(prev =>
      prev.includes(sourceName)
        ? prev.filter(s => s !== sourceName)
        : [...prev, sourceName]
    );
  };

  const filteredSources = categoryFilter === "all"
    ? allSources
    : allSources.filter(s => s.category === categoryFilter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 lg:w-72 xl:w-80 bg-white border-r border-slate-200 flex flex-col transform ${showMobileMenu ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out`}>
        <div className="p-4 lg:p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Stethoscope className="w-5 h-5 lg:w-6 lg:h-6 text-white" />
          </div>
          <span className="font-bold text-lg lg:text-xl text-slate-900">MedWatch</span>
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
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors disabled:opacity-50 text-sm lg:text-base"
          >
            <RefreshCw size={20} className={isRefreshing ? "animate-spin" : ""} />
            <span>Rafraîchir</span>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors text-sm lg:text-base"
          >
            <LogOut size={20} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setShowMobileMenu(false)}
        ></div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-0 overflow-y-auto min-h-screen">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="lg:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Menu size={20} />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Veille Médicale
                </h1>
                <p className="text-slate-500 text-sm mt-1">Collecte, analyse et publication d'articles médicaux</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-auto">
              <StatusButton active={filter === "pending"} onClick={() => setFilter("pending")} label="📋 En attente" />
              <StatusButton active={filter === "approved"} onClick={() => setFilter("approved")} label="✅ Approuvés" />
              <StatusButton active={filter === "published"} onClick={() => setFilter("published")} label="🚀 Publiés" />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Source Filter Panel */}
        <div className="mb-6 lg:mb-8">
          <button
            onClick={() => setShowSourcePanel(!showSourcePanel)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-semibold text-slate-700 w-full sm:w-auto"
          >
            <Filter size={18} />
            <span className="hidden sm:inline">Filtrer par sources</span>
            <span className="sm:hidden">Filtres</span>
            ({sourcefilters.length})
            {showSourcePanel ? <X size={16} /> : <span className="ml-auto">▼</span>}
          </button>

          {showSourcePanel && (
            <div className="mt-4 bg-white border border-slate-200 rounded-xl p-4 lg:p-6 shadow-lg">
              {/* Category tabs */}
              <div className="flex flex-wrap gap-2 mb-6 pb-4 border-b border-slate-200">
                <CategoryTab
                  active={categoryFilter === "all"}
                  onClick={() => setCategoryFilter("all")}
                  label="Toutes (70+)"
                  icon="📊"
                />
                <CategoryTab
                  active={categoryFilter === "api"}
                  onClick={() => setCategoryFilter("api")}
                  label="API (20)"
                  icon="🔌"
                />
                <CategoryTab
                  active={categoryFilter === "rss"}
                  onClick={() => setCategoryFilter("rss")}
                  label="RSS (25)"
                  icon="📡"
                />
                <CategoryTab
                  active={categoryFilter === "scrape"}
                  onClick={() => setCategoryFilter("scrape")}
                  label="Web (17)"
                  icon="🕷️"
                />
              </div>

              {/* Source grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 lg:gap-3">
                {filteredSources.map((source) => (
                  <button
                    key={source.name}
                    onClick={() => toggleSourceFilter(source.name)}
                    className={`p-2 lg:p-3 rounded-lg border-2 transition-all text-xs lg:text-sm font-semibold text-center ${
                      sourcefilters.includes(source.name)
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <div className="text-base lg:text-lg mb-1">{source.icon}</div>
                    <div className="line-clamp-2 leading-tight">{source.label}</div>
                  </button>
                ))}
              </div>

              {sourcefilters.length > 0 && (
                <button
                  onClick={() => setSourceFilters([])}
                  className="mt-4 text-sm text-slate-500 hover:text-slate-700 underline"
                >
                  Effacer tous les filtres
                </button>
              )}
            </div>
          )}
        </div>
        {/* Articles Grid */}
        {articles.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 lg:p-16 text-center">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-slate-500 font-semibold text-lg">Aucun article trouvé</p>
            <p className="text-slate-400 text-sm mt-2">Essayez de modifier les filtres ou attendez que les sources se synchronisent</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6">
            {articles.map((article) => (
              <div key={article.id}>
                <ArticleCard
                  article={article}
                  onAnalyze={() => handleAnalyze(article)}
                  onReject={() => handleReject(article.id)}
                  onEdit={() => navigate(`/editor/${article.id}`)}
                  isAnalyzing={analyzingId === article.id}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      </main>
    </div>
  );
}

function NavLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(to)}
      className="w-full flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all font-medium text-left"
    >
      {icon}
      {label}
    </button>
  );
}

function StatusButton({
  active,
  onClick,
  label
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 lg:px-4 py-2 rounded-lg text-xs lg:text-sm font-semibold transition-all flex-1 sm:flex-none ${
        active
          ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md"
          : "text-slate-600 hover:text-slate-900 hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}

function CategoryTab({
  active,
  onClick,
  label,
  icon
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 lg:px-4 py-2 rounded-lg font-semibold text-xs lg:text-sm transition-all flex items-center gap-2 ${
        active
          ? "bg-blue-100 text-blue-700 border-b-2 border-blue-600"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      <span className="text-base lg:text-lg">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{label.split(' ')[0]}</span>
    </button>
  );
}

function ArticleCard({
  article,
  onAnalyze,
  onReject,
  onEdit,
  isAnalyzing
}: {
  article: any;
  onAnalyze: () => Promise<void>;
  onReject: () => Promise<void>;
  onEdit: () => void;
  isAnalyzing: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-xl transition-all overflow-hidden group">
      {/* Header with source badge */}
      <div className="p-3 lg:p-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <SourceBadge source={article.source} />
          {article.reliability_score && (
            <div className="flex items-center gap-2">
              <div className="w-20 lg:w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    article.reliability_score > 70 ? "bg-green-500" : "bg-orange-500"
                  }`}
                  style={{ width: `${article.reliability_score}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-600">{article.reliability_score}%</span>
            </div>
          )}
        </div>
        <p className="text-xs text-slate-500">{article.published_date}</p>
      </div>

      {/* Content */}
      <div className="p-4 lg:p-5">
        <h3 className="text-base lg:text-lg font-bold text-slate-900 mb-3 line-clamp-2 group-hover:text-blue-600 transition-colors">
          {article.title}
        </h3>
        <p className="text-slate-600 text-sm line-clamp-3 mb-4">
          {article.abstract || "Pas de résumé disponible."}
        </p>

        {/* Quick stats */}
        {(article.mentions_drug || article.mentions_disease) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {article.mentions_drug && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full font-semibold">
                💊 {article.mentions_drug}
              </span>
            )}
            {article.mentions_disease && (
              <span className="px-2 py-1 bg-red-100 text-red-700 text-xs rounded-full font-semibold">
                🏥 {article.mentions_disease}
              </span>
            )}
          </div>
        )}

        {/* Link */}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-semibold mb-4"
        >
          <ExternalLink size={14} /> Voir la source complète
        </a>
      </div>

      {/* Actions */}
      <div className="px-4 lg:px-5 py-3 lg:py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
        {!article.summary_facebook ? (
          <button
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="flex-1 flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 font-semibold text-sm"
          >
            <BrainCircuit size={16} className={isAnalyzing ? "animate-spin" : ""} />
            {isAnalyzing ? "Analyse..." : "Analyser par IA"}
          </button>
        ) : (
          <button
            onClick={onEdit}
            className="flex-1 flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all font-semibold text-sm"
          >
            <Edit2 size={16} /> Éditer & Publier
          </button>
        )}
        <button
          onClick={onReject}
          className="flex items-center justify-center gap-2 px-3 lg:px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-all font-semibold text-sm border border-red-200"
        >
          <XCircle size={16} />
        </button>
      </div>
    </div>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, { bg: string; text: string; icon: string }> = {
    pubmed: { bg: "bg-blue-100", text: "text-blue-700", icon: "🔬" },
    clinical_trials: { bg: "bg-purple-100", text: "text-purple-700", icon: "🧪" },
    europe_pmc: { bg: "bg-indigo-100", text: "text-indigo-700", icon: "📚" },
    openalex: { bg: "bg-cyan-100", text: "text-cyan-700", icon: "🌐" },
    biorxiv: { bg: "bg-orange-100", text: "text-orange-700", icon: "📄" },
    medrxiv: { bg: "bg-orange-100", text: "text-orange-700", icon: "📄" },
    openfda: { bg: "bg-yellow-100", text: "text-yellow-700", icon: "⚠️" },
    chembl: { bg: "bg-teal-100", text: "text-teal-700", icon: "🧬" },
    orphanet: { bg: "bg-violet-100", text: "text-violet-700", icon: "🏥" },
    nejm_rss: { bg: "bg-rose-100", text: "text-rose-700", icon: "📰" },
    lancet_rss: { bg: "bg-rose-100", text: "text-rose-700", icon: "📰" },
    ema_rss: { bg: "bg-emerald-100", text: "text-emerald-700", icon: "🇪🇺" },
    fda_rss: { bg: "bg-amber-100", text: "text-amber-700", icon: "🇺🇸" },
    who_rss: { bg: "bg-blue-100", text: "text-blue-700", icon: "🌍" }
  };

  const style = colors[source] || { bg: "bg-slate-100", text: "text-slate-700", icon: "📌" };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs ${style.bg} ${style.text}`}>
      <span>{style.icon}</span>
      {source.toUpperCase()}
    </span>
  );
}
