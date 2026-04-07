import React, { useState, useEffect } from "react";
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate
} from "react-router-dom";
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { Stethoscope } from "lucide-react";
import { auth } from "./firebase";
import Dashboard from "./components/Dashboard";
import ArticleEditor from "./components/ArticleEditor";
import Calendar from "./components/Calendar";
import StatsDashboard from "./components/StatsDashboard";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bypassAuth, setBypassAuth] = useState(false);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user && !bypassAuth) {
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
          <div className="space-y-4">
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-200"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
              Se connecter avec Google
            </button>
            <button
              onClick={() => setBypassAuth(true)}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg"
            >
              Mode développement (sans connexion)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/editor/:id" element={<ArticleEditor />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/stats" element={<StatsDashboard />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
