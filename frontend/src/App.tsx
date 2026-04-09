import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ApiPage from "./pages/ApiPage";
import DocsPage from "./pages/DocsPage";
import NotFoundPage from "./pages/NotFoundPage";
import PrivacyPage from "./pages/PrivacyPage";
import SmtpTesterPage from "./pages/SmtpTesterPage";
import StatusPage from "./pages/StatusPage";
import TermsPage from "./pages/TermsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<SmtpTesterPage />} />
          <Route path="/docs" element={<DocsPage />} />
          <Route path="/api" element={<ApiPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
