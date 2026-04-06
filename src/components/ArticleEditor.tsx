import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { Save, Send, Calendar, ArrowLeft, Smartphone, Check, Image as ImageIcon, Sparkles } from "lucide-react";
import { generatePostImage } from "../services/geminiService";

export default function ArticleEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [article, setArticle] = useState<any>(null);
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  useEffect(() => {
    if (id) {
      getDoc(doc(db, "articles", id)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setArticle({ id: snap.id, ...data });
          setContent(data.summary_facebook || "");
          setImageUrl(data.image_url || null);
        }
      });
    }
  }, [id]);

  const handleGenerateImage = async () => {
    if (!article) return;
    setIsGeneratingImage(true);
    try {
      const url = await generatePostImage({ title: article.title, type: article.type });
      if (url) {
        setImageUrl(url);
        await updateDoc(doc(db, "articles", article.id), { image_url: url });
      }
    } catch (error) {
      console.error("Image generation failed", error);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "articles", id), { 
        summary_facebook: content,
        image_url: imageUrl
      });
      alert("Brouillon sauvegardé !");
    } catch (error) {
      console.error("Save failed", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    try {
      await updateDoc(doc(db, "articles", id), { 
        summary_facebook: content,
        status: "approved",
        validated_at: serverTimestamp()
      });
      alert("Article approuvé !");
      navigate("/dashboard");
    } catch (error) {
      console.error("Approval failed", error);
    }
  };

  if (!article) return <div className="p-8">Chargement...</div>;

  return (
    <div className="h-full flex flex-col">
      <header className="bg-white border-b border-slate-200 p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-slate-900">Éditeur de Publication</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-semibold transition-colors"
          >
            <Save size={18} /> Sauvegarder
          </button>
          <button
            onClick={handleApprove}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-semibold transition-all shadow-lg shadow-blue-200"
          >
            <Check size={18} /> Approuver
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className="flex-1 p-8 overflow-y-auto border-r border-slate-200">
          <div className="max-w-2xl mx-auto">
            <div className="mb-8">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Article Source</h2>
              <h3 className="text-2xl font-bold text-slate-900 mb-4">{article.title}</h3>
              <div className="bg-slate-100 p-4 rounded-xl text-slate-600 text-sm italic">
                {article.summary_web}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">
                Texte Facebook
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-64 p-6 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none text-slate-800 leading-relaxed"
                placeholder="Écrivez votre post ici..."
              />
              <div className="mt-2 text-right text-xs text-slate-400">
                {content.length} caractères
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="w-[450px] bg-slate-100 p-8 overflow-y-auto flex flex-col items-center">
          <div className="flex items-center gap-2 text-slate-400 mb-6 font-bold text-sm uppercase tracking-widest">
            <Smartphone size={16} /> Preview Mobile
          </div>
          
          <div className="w-full max-w-[360px] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">MW</div>
              <div>
                <div className="font-bold text-sm">MedWatch AI</div>
                <div className="text-xs text-slate-500">À l'instant · 🌍</div>
              </div>
            </div>
            
            <div className="px-4 pb-4 text-sm text-slate-800 whitespace-pre-wrap">
              {content || "Votre texte apparaîtra ici..."}
            </div>

            {/* Mock Image */}
            <div className="aspect-[1200/630] bg-slate-200 relative flex items-center justify-center overflow-hidden">
              {imageUrl ? (
                <img src={imageUrl} className="w-full h-full object-cover" alt="Post visual" referrerPolicy="no-referrer" />
              ) : (
                <>
                  <div className={`absolute inset-0 bg-gradient-to-br ${getGradient(article.type)} opacity-90`} />
                  <div className="relative z-10 p-6 text-center">
                    <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full inline-block text-[10px] font-bold text-white uppercase mb-2 border border-white/30">
                      {article.type || "Nouveauté"}
                    </div>
                    <div className="text-white font-bold text-lg leading-tight line-clamp-3 drop-shadow-lg">
                      {article.title}
                    </div>
                  </div>
                </>
              )}
              <div className="absolute bottom-2 right-2 text-[8px] text-white/50 font-mono">
                MEDWATCH AI
              </div>
            </div>

            <div className="p-3 border-t border-slate-100 flex justify-between">
              <div className="flex gap-4 text-slate-500 text-xs font-bold">
                <span>Like</span>
                <span>Comment</span>
                <span>Share</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerateImage}
            disabled={isGeneratingImage}
            className="mt-6 flex items-center gap-2 px-6 py-3 bg-white text-purple-600 border border-purple-200 hover:bg-purple-50 rounded-xl font-bold transition-all shadow-sm disabled:opacity-50"
          >
            <Sparkles size={18} className={isGeneratingImage ? "animate-spin" : ""} />
            {isGeneratingImage ? "Génération..." : "Générer un visuel IA"}
          </button>
        </div>
      </div>
    </div>
  );
}

function getGradient(type: string) {
  switch (type) {
    case "medication": return "from-blue-600 to-blue-900";
    case "protocol": return "from-emerald-600 to-emerald-900";
    case "case_study": return "from-purple-600 to-purple-900";
    case "guideline": return "from-amber-600 to-amber-900";
    default: return "from-slate-600 to-slate-900";
  }
}
