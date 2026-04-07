import axios from "axios";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { rssSources, scrapeSources, apiSources } from "./sourceConfig";

// Helper function to deduplicate articles by title and source
const deduplicateArticles = async (articles: any[]) => {
  for (const article of articles) {
    const q = query(
      collection(db, "articles"),
      where("source", "==", article.source),
      where("title", "==", article.title)
    );
    const snapshot = await getDocs(q);
    if (snapshot.docs.length === 0) {
      await addDoc(collection(db, "articles"), article);
    }
  }
};

export const fetchPubMedArticles = async () => {
  const term = '("new drug"[Title/Abstract] OR "phase III"[Title/Abstract] OR "FDA approval"[Title/Abstract] OR "clinical trial results"[Title/Abstract] OR "treatment guideline"[Title/Abstract] OR "rare case"[Title/Abstract])';
  const reldate = 1;
  
  try {
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
        abstract: s.abstract || "",
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        published_date: s.pubdate,
        status: "pending",
        created_at: serverTimestamp()
      };
    });

    await deduplicateArticles(articles);
    return articles;
  } catch (error) {
    console.error("PubMed fetch error:", error);
    return [];
  }
};

export const fetchAllAPISources = async () => {
  const allArticles: any[] = [];
  
  try {
    const endpoints = [
      { endpoint: "/api/clinicaltrials", parser: parseClinicalTrials },
      { endpoint: "/api/openfda", parser: parseOpenFDA },
      { endpoint: "/api/europepmc", parser: parseEuropePMC },
      { endpoint: "/api/crossref", parser: parseCrossRef },
      { endpoint: "/api/semanticscholar", parser: parseSemanticScholar },
      { endpoint: "/api/chembl", parser: parseChEMBL },
      { endpoint: "/api/orphanet", parser: parseOrphanet },
    ];

    for (const { endpoint, parser } of endpoints) {
      try {
        const res = await axios.get(endpoint);
        const articles = parser(res.data);
        allArticles.push(...articles);
      } catch (error) {
        console.warn(`API endpoint ${endpoint} failed:`, error);
      }
    }

    await deduplicateArticles(allArticles);
    return allArticles;
  } catch (error) {
    console.error("API sources fetch error:", error);
    return [];
  }
};

const parseClinicalTrials = (data: any): any[] => {
  const studies = data.studies || [];
  return studies.map((s: any) => ({
    source: "clinical_trials",
    external_id: s.protocolSection?.identificationModule?.nctId,
    title: s.protocolSection?.identificationModule?.officialTitle || s.protocolSection?.identificationModule?.briefTitle,
    abstract: s.protocolSection?.descriptionModule?.briefSummary,
    url: `https://clinicaltrials.gov/study/${s.protocolSection?.identificationModule?.nctId}`,
    published_date: s.protocolSection?.statusModule?.lastUpdatePostDate,
    status: "pending",
    created_at: serverTimestamp()
  }));
};

const parseOpenFDA = (data: any): any[] => {
  return (data.results || []).slice(0, 20).map((r: any) => ({
    source: "openfda",
    external_id: r.id || r.brand_name?.[0],
    title: `FDA Alert: ${r.brand_name?.[0] || "Drug"}`,
    abstract: r.adverse_reactions?.[0] || r.summary || "",
    url: "https://api.fda.gov",
    published_date: new Date().toISOString(),
    status: "pending",
    created_at: serverTimestamp()
  }));
};

const parseEuropePMC = (data: any): any[] => {
  const results = data.resultList?.result || [];
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

const parseCrossRef = (data: any): any[] => {
  const items = data.message?.items || [];
  return items.slice(0, 20).map((item: any) => ({
    source: "crossref",
    external_id: item.DOI,
    title: item.title?.[0] || "Research Article",
    abstract: item.abstract || "",
    url: `https://doi.org/${item.DOI}`,
    published_date: item.created?.["date-time"] || new Date().toISOString(),
    status: "pending",
    created_at: serverTimestamp()
  }));
};

const parseSemanticScholar = (data: any): any[] => {
  const data_list = data.data || [];
  return data_list.slice(0, 20).map((paper: any) => ({
    source: "semantic_scholar",
    external_id: paper.paperId,
    title: paper.title,
    abstract: paper.abstract || "",
    url: `https://www.semanticscholar.org/paper/${paper.paperId}`,
    published_date: paper.year?.toString(),
    status: "pending",
    created_at: serverTimestamp()
  }));
};

const parseChEMBL = (data: any): any[] => {
  const molecules = data.molecules || [];
  return molecules.slice(0, 20).map((mol: any) => ({
    source: "chembl",
    external_id: mol.molecule_chembl_id,
    title: `ChEMBL: ${mol.pref_name}`,
    abstract: mol.molecule_type || "",
    url: `https://www.ebi.ac.uk/chembl/compound/${mol.molecule_chembl_id}`,
    published_date: new Date().toISOString(),
    status: "pending",
    created_at: serverTimestamp()
  }));
};

const parseOrphanet = (data: any): any[] => {
  const disorders = data.DisorderList?.Disorder || [];
  return (Array.isArray(disorders) ? disorders : [disorders]).slice(0, 20).map((d: any) => ({
    source: "orphanet",
    external_id: d["@id"],
    title: d.Name,
    abstract: `Rare disease - Status: ${d.DisorderStatus}`,
    url: `https://www.orpha.net/consor/cgi-bin/OC_Exp.php?Lng=EN&Expert=${d["@id"]}`,
    published_date: new Date().toISOString(),
    status: "pending",
    created_at: serverTimestamp()
  }));
};

export const fetchAllRSSSources = async () => {
  const allArticles: any[] = [];

  for (const source of rssSources) {
    try {
      const articles = await fetchRSSArticles(source.url, source.name);
      allArticles.push(...articles);
    } catch (error) {
      console.warn(`RSS source ${source.label} failed:`, error);
    }
  }

  await deduplicateArticles(allArticles);
  return allArticles;
};

export const fetchRSSArticles = async (url: string, sourceName: string) => {
  try {
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
  } catch (error) {
    console.error(`Error fetching RSS ${sourceName}:`, error);
    return [];
  }
};

export const fetchAllScrapeSources = async () => {
  const allArticles: any[] = [];

  for (const source of scrapeSources) {
    try {
      const articles = await fetchScrapeSource(source);
      allArticles.push(...articles);
    } catch (error) {
      console.warn(`Scrape source ${source.label} failed:`, error);
    }
  }

  await deduplicateArticles(allArticles);
  return allArticles;
};

export const fetchScrapeSource = async (source: any) => {
  try {
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
  } catch (error) {
    console.error(`Error scraping source ${source.label}:`, error);
    return [];
  }
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
