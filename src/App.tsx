import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";
import Dashboard from "./components/Dashboard";
import ArticleEditor from "./components/ArticleEditor";
import Calendar from "./components/Calendar";
import StatsDashboard from "./components/StatsDashboard";

export default function App() {
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
