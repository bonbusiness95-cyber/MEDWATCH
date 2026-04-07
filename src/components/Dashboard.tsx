import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { Eye, Edit2, CheckCircle, XCircle, ExternalLink, BrainCircuit } from "lucide-react";
import { analyzeArticle } from "../services/geminiService";
import { allSourceLabels } from "../services/sourceConfig";

export default function Dashboard() {
  const [articles, setArticles] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let q = query(
      collection(db, "articles"),
      where("status", "==", filter),
      orderBy("created_at", "desc")
    );

    if (sourceFilter !== "all") {
      q = query(q, where("source", "==", sourceFilter));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setArticles(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return unsubscribe;
  }, [filter, sourceFilter]);

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

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Veille Médicale</h1>
          <p className="text-slate-500">Gérez les articles collectés et préparez les publications.</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          <FilterButton active={filter === "pending"} onClick={() => setFilter("pending")} label="En attente" />
          <FilterButton active={filter === "approved"} onClick={() => setFilter("approved")} label="Approuvés" />
          <FilterButton active={filter === "published"} onClick={() => setFilter("published")} label="Publiés" />
        </div>
      </div>

      <div className="flex gap-4 mb-6 overflow-x-auto pb-2 scrollbar-hide">
        <SourceFilter active={sourceFilter === "all"} onClick={() => setSourceFilter("all")} label="Toutes les sources" />
        <SourceFilter active={sourceFilter === "pubmed"} onClick={() => setSourceFilter("pubmed")} label="PubMed" />
        <SourceFilter active={sourceFilter === "clinical_trials"} onClick={() => setSourceFilter("clinical_trials")} label="Essais Cliniques" />
        <SourceFilter active={sourceFilter === "europe_pmc"} onClick={() => setSourceFilter("europe_pmc")} label="Europe PMC" />
        {allSourceLabels.map((source) => (
          <SourceFilter
            key={source.source}
            active={sourceFilter === source.source}
            onClick={() => setSourceFilter(source.source)}
            label={source.label}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {articles.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400">
            Aucun article trouvé dans cette catégorie.
          </div>
        ) : (
          articles.map((article) => (
            <div key={article.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-all group">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${getSourceColor(article.source)}`}>
                      {article.source}
                    </span>
                    <span className="text-xs text-slate-400">
                      {article.published_date}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors">
                    {article.title}
                  </h3>
                  <p className="text-slate-600 line-clamp-2 text-sm mb-4">
                    {article.abstract || "Pas de résumé disponible."}
                  </p>
                  
                  <div className="flex items-center gap-4">
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink size={14} /> Voir la source
                    </a>
                    {article.reliability_score && (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${article.reliability_score > 70 ? 'bg-green-500' : 'bg-orange-500'}`}
                            style={{ width: `${article.reliability_score}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-500">{article.reliability_score}%</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {!article.summary_facebook ? (
                    <button
                      onClick={() => handleAnalyze(article)}
                      disabled={analyzingId === article.id}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors text-sm font-semibold disabled:opacity-50"
                    >
                      <BrainCircuit size={18} className={analyzingId === article.id ? "animate-spin" : ""} />
                      {analyzingId === article.id ? "Analyse..." : "Analyser par IA"}
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(`/editor/${article.id}`)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors text-sm font-semibold"
                    >
                      <Edit2 size={18} /> Éditer & Publier
                    </button>
                  )}
                  <button
                    onClick={() => handleReject(article.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors text-sm font-semibold"
                  >
                    <XCircle size={18} /> Rejeter
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
        active ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function SourceFilter({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all border ${
        active 
          ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
          : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"
      }`}
    >
      {label}
    </button>
  );
}

function getSourceColor(source: string) {
  switch (source) {
    case "pubmed": return "bg-blue-100 text-blue-700";
    case "clinical_trials": return "bg-purple-100 text-purple-700";
    case "europe_pmc": return "bg-indigo-100 text-indigo-700";
    case "twitter": return "bg-sky-100 text-sky-700";
    case "ema_rss": return "bg-emerald-100 text-emerald-700";
    case "fda_rss": return "bg-amber-100 text-amber-700";
    case "openalex": return "bg-cyan-100 text-cyan-700";
    case "biorxiv":
    case "medrxiv": return "bg-orange-100 text-orange-700";
    case "openfda": return "bg-yellow-100 text-yellow-700";
    case "chembl": return "bg-teal-100 text-teal-700";
    case "orphanet": return "bg-violet-100 text-violet-700";
    case "plos_ntd_rss":
    case "malaria_journal_rss": return "bg-lime-100 text-lime-700";
    case "nejm_rss":
    case "lancet_rss":
    case "nature_med_rss": return "bg-rose-100 text-rose-700";
    default: return "bg-slate-100 text-slate-700";
  }
}
