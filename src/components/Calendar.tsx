import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ArrowLeft } from "lucide-react";

export default function Calendar() {
  const [scheduled, setScheduled] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(collection(db, "articles"), where("status", "==", "approved"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setScheduled(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsubscribe;
  }, []);

  return (
    <div className="p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
        >
          <ArrowLeft size={18} /> Retour
        </button>
        <h1 className="text-3xl font-bold text-slate-900">Calendrier Éditorial</h1>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {scheduled.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400">
            Aucune publication programmée pour le moment.
          </div>
        ) : (
          scheduled.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600 font-bold text-center min-w-[80px]">
                <div className="text-xs uppercase">Bientôt</div>
                <div className="text-xl">--</div>
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-1">{item.summary_facebook}</p>
              </div>
              <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold uppercase">
                Approuvé
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
