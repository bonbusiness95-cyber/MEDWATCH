import axios from "axios";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { RSSSource, ScrapeSource } from "./sourceConfig";

export const fetchPubMedArticles = async () => {
  const term = '("new drug"[Title/Abstract] OR "phase III"[Title/Abstract] OR "FDA approval"[Title/Abstract] OR "clinical trial results"[Title/Abstract] OR "treatment guideline"[Title/Abstract] OR "rare case"[Title/Abstract])';
  const reldate = 1; // Last 24 hours
  
  const searchRes = await axios.get("/api/pubmed/search", { params: { term, reldate } });
  const ids = searchRes.data.esearchresult.idlist;
  
  if (!ids || ids.length === 0) return [];

  const summaryRes = await axios.get("/api/pubmed/summary", { params: { id: ids.join(",") } });
  const summaries = summaryRes.data.result;
  
  const articles = ids.map((id: string) => {
    const s = summaries[id];
    return {
      source: "pubmed",
      external_id: id,
      title: s.title,
      abstract: s.abstract || "", // PubMed summary might not have full abstract
      url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
      published_date: s.pubdate,
      status: "pending",
      created_at: serverTimestamp()
    };
  });

  return articles;
};

export const fetchRSSArticles = async (url: string, sourceName: string) => {
  const res = await axios.get("/api/rss", { params: { url } });
  const items = res.data;
  
  return items.map((item: any) => ({
    source: sourceName,
    external_id: item.guid || item.link,
    title: item.title,
    abstract: item.description,
    url: item.link,
    published_date: item.pubDate,
    status: "pending",
    created_at: serverTimestamp()
  }));
};

export const fetchScrapeSource = async (source: ScrapeSource) => {
  const res = await axios.post("/api/scrape", source);
  const items = res.data || [];

  return items.map((item: any) => ({
    source: source.name,
    external_id: item.link,
    title: item.title,
    abstract: item.description || "",
    url: item.link,
    published_date: item.pubDate || "",
    status: "pending",
    created_at: serverTimestamp()
  }));
};

export const fetchClinicalTrials = async () => {
  const term = "phase 3 AND (recruiting OR active, not recruiting)";
  const res = await axios.get("/api/clinicaltrials", { params: { term } });
  const studies = res.data.studies || [];
  
  return studies.map((s: any) => ({
    source: "clinical_trials",
    external_id: s.protocolSection.identificationModule.nctId,
    title: s.protocolSection.identificationModule.officialTitle || s.protocolSection.identificationModule.briefTitle,
    abstract: s.protocolSection.descriptionModule.briefSummary,
    url: `https://clinicaltrials.gov/study/${s.protocolSection.identificationModule.nctId}`,
    published_date: s.protocolSection.statusModule.lastUpdatePostDate,
    status: "pending",
    created_at: serverTimestamp()
  }));
};

export const fetchEuropePMC = async () => {
  const query = "new drug approval 2026";
  const res = await axios.get("/api/europepmc", { params: { query } });
  const results = res.data.resultList.result || [];
  
  return results.map((r: any) => ({
    source: "europe_pmc",
    external_id: r.id,
    title: r.title,
    abstract: r.abstractText || "",
    url: `https://europepmc.org/article/${r.source}/${r.id}`,
    published_date: r.firstPublicationDate,
    status: "pending",
    created_at: serverTimestamp()
  }));
};

export const fetchOpenAlex = async () => {
  const search = "phytomedicine OR ethnopharmacology OR plant medicinal";
  const res = await axios.get("/api/openalex", { params: { search } });
  const results = res.data.results || [];
  
  return results.map((r: any) => ({
    source: "openalex",
    external_id: r.id,
    title: r.title,
    abstract: r.abstract || "",
    url: r.doi || r.id,
    published_date: r.publication_date,
    status: "pending",
    created_at: serverTimestamp()
  }));
};

export const fetchBioRxiv = async (server: "biorxiv" | "medrxiv") => {
  const res = await axios.get("/api/biorxiv", { params: { server } });
  const collection = res.data.collection || [];
  
  return collection.slice(0, 10).map((p: any) => ({
    source: server,
    external_id: p.doi,
    title: p.title,
    abstract: p.abstract || "",
    url: `https://doi.org/${p.doi}`,
    published_date: p.date,
    status: "pending",
    created_at: serverTimestamp()
  }));
};

export const fetchOpenFDA = async () => {
  const search = "effective_time:[20260101 TO 20261231]";
  const res = await axios.get("/api/openfda", { params: { search } });
  const results = res.data.results || [];
  
  return results.map((r: any) => ({
    source: "openfda",
    external_id: r.id,
    title: r.openfda?.brand_name?.[0] || "New Drug Label",
    abstract: r.indications_and_usage?.[0] || "Drug information from FDA",
    url: `https://labels.fda.gov/`,
    published_date: r.effective_time,
    status: "pending",
    created_at: serverTimestamp()
  }));
};

export const fetchChEMBL = async () => {
  const query = "alkaloid";
  const res = await axios.get("/api/chembl", { params: { query } });
  const molecules = res.data.molecules || [];
  
  return molecules.map((m: any) => ({
    source: "chembl",
    external_id: m.molecule_chembl_id,
    title: m.pref_name || m.molecule_chembl_id,
    abstract: `Molecular Formula: ${m.molecule_properties?.full_mwt || "N/A"}. Type: ${m.molecule_type}`,
    url: `https://www.ebi.ac.uk/chembl/compound_report_card/${m.molecule_chembl_id}/`,
    published_date: new Date().toISOString().split('T')[0],
    status: "pending",
    created_at: serverTimestamp()
  }));
};

export const fetchOrphanet = async () => {
  try {
    const res = await axios.get("/api/orphanet", { params: { query: "rare disease" } });
    const results = res.data.results || [];
    
    return results.map((r: any) => ({
      source: "orphanet",
      external_id: r.id,
      title: r.name || "Rare Disease Entry",
      abstract: r.description || "Information about rare diseases and orphan drugs.",
      url: `https://www.orpha.net/consor/cgi-bin/OC_Exp.php?lng=EN&Expert=${r.id}`,
      published_date: new Date().toISOString().split('T')[0],
      status: "pending",
      created_at: serverTimestamp()
    }));
  } catch (e) {
    return []; // Graceful failure for Orphanet as it's a mock endpoint for now
  }
};

export const saveArticles = async (articles: any[]) => {
  const articlesRef = collection(db, "articles");
  for (const article of articles) {
    // Check for duplicates
    const q = query(articlesRef, where("external_id", "==", article.external_id));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      await addDoc(articlesRef, article);
    }
  }
};

export const seedTestData = async () => {
  const testArticles = [
    {
      source: "pubmed",
      external_id: "test_1",
      title: "New Breakthrough in Alzheimer's Treatment: Phase III Results",
      abstract: "A new monoclonal antibody has shown significant reduction in amyloid plaques in patients with early-stage Alzheimer's disease. The study involved 1,800 participants over 18 months.",
      url: "https://pubmed.ncbi.nlm.nih.gov/test_1/",
      published_date: "2026-04-01",
      status: "pending",
      created_at: serverTimestamp(),
      reliability_score: 85,
      type: "medication"
    },
    {
      source: "ema_rss",
      external_id: "test_2",
      title: "EMA Recommends Approval for New Gene Therapy for Hemophilia B",
      abstract: "The European Medicines Agency has recommended granting a marketing authorisation for a new gene therapy designed to treat adults with severe Hemophilia B.",
      url: "https://www.ema.europa.eu/en/news/test_2",
      published_date: "2026-04-05",
      status: "pending",
      created_at: serverTimestamp(),
      reliability_score: 92,
      type: "guideline"
    }
  ];
  await saveArticles(testArticles);
};
