import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function StatsDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    published: 0,
    approvalRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const q = query(collection(db, "articles"));
        const snapshot = await getDocs(q);
        const all = snapshot.docs.map(d => d.data());
        
        const total = all.length;
        const approved = all.filter(a => a.status === "approved").length;
        const published = all.filter(a => a.status === "published").length;
        const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

        setStats({ total, approved, published, approvalRate });
      } catch (error) {
        console.error("Failed to fetch stats", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) return <div className="p-8 text-slate-400">Chargement des statistiques...</div>;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
        >
          <ArrowLeft size={18} /> Retour
        </button>
        <h1 className="text-3xl font-bold text-slate-900">Statistiques de Veille</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard label="Articles Collectés" value={stats.total.toString()} change="Total" />
        <StatCard label="Taux d'Approbation" value={`${stats.approvalRate}%`} change="Moyenne" />
        <StatCard label="Posts Publiés" value={stats.published.toString()} change="Facebook" />
      </div>
      
      <div className="bg-white p-8 rounded-2xl border border-slate-200">
        <h2 className="text-lg font-bold text-slate-900 mb-4">Répartition par Statut</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden flex">
            <div className="bg-blue-500 h-full" style={{ width: `${(stats.total - stats.approved - stats.published) / stats.total * 100}%` }} />
            <div className="bg-emerald-500 h-full" style={{ width: `${stats.approved / stats.total * 100}%` }} />
            <div className="bg-purple-500 h-full" style={{ width: `${stats.published / stats.total * 100}%` }} />
          </div>
        </div>
        <div className="flex gap-6 mt-4 text-xs font-bold uppercase tracking-wider">
          <div className="flex items-center gap-2 text-blue-500">
            <div className="w-3 h-3 bg-blue-500 rounded-full" /> En attente
          </div>
          <div className="flex items-center gap-2 text-emerald-500">
            <div className="w-3 h-3 bg-emerald-500 rounded-full" /> Approuvés
          </div>
          <div className="flex items-center gap-2 text-purple-500">
            <div className="w-3 h-3 bg-purple-500 rounded-full" /> Publiés
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, change }: { label: string; value: string; change: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <div className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">{label}</div>
      <div className="flex items-end gap-3">
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <div className="text-sm font-bold text-slate-400 mb-1">{change}</div>
      </div>
    </div>
  );
}
