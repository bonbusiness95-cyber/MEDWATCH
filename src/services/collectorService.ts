import axios from "axios";
import { collection, addDoc, query, where, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { rssSources, scrapeSources, apiSources } from "./sourceConfig";

// Classify article based on content
const classifyArticle = (article: any) => {
  const text = `${article.title} ${article.abstract}`.toLowerCase();
  
  if (text.includes("new drug") || text.includes("phase iii") || text.includes("fda approval") || text.includes("clinical trial results")) {
    return { ...article, category: "medication" };
  }
  
  if (text.includes("treatment guideline")) {
    return { ...article, category: "guideline" };
  }
  
  if (text.includes("rare case")) {
    return { ...article, category: "rare_case" };
  }
  
  return { ...article, category: "other" };
};

// Helper function to deduplicate articles by title and source
const deduplicateArticles = async (articles: any[]) => {
  for (const article of articles) {
    // Classify the article but keep all collected articles visible.
    const classifiedArticle = classifyArticle(article);
    const status = "pending";

    const q = query(
      collection(db, "articles"),
      where("source", "==", article.source),
      where("title", "==", article.title)
    );
    const snapshot = await getDocs(q);
    if (snapshot.docs.length === 0) {
      await addDoc(collection(db, "articles"), { ...classifiedArticle, status, created_at: serverTimestamp() });
    }
  }
};

export const fetchPubMedArticles = async () => {
  const term = "all[sb]";
  const reldate = 7;
  
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
        published_date: s.pubdate
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
    published_date: s.protocolSection?.statusModule?.lastUpdatePostDate
  }));
};

const parseOpenFDA = (data: any): any[] => {
  return (data.results || []).slice(0, 20).map((r: any) => ({
    source: "openfda",
    external_id: r.id || r.brand_name?.[0],
    title: `FDA Alert: ${r.brand_name?.[0] || "Drug"}`,
    abstract: r.adverse_reactions?.[0] || r.summary || "",
    url: "https://api.fda.gov",
    published_date: new Date().toISOString()
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
    published_date: r.firstPublicationDate
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
    published_date: item.created?.["date-time"] || new Date().toISOString()
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
    published_date: paper.year?.toString()
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
    published_date: new Date().toISOString()
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
    published_date: new Date().toISOString()
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
      published_date: item.pubDate
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
      published_date: item.pubDate || ""
    }));
  } catch (error) {
    console.error(`Error scraping source ${source.label}:`, error);
    return [];
  }
};

export const fetchOpenAlex = async () => {
  const res = await axios.get("/api/openalex");
  const results = res.data.results || [];
  
  return results.map((r: any) => ({
    source: "openalex",
    external_id: r.id,
    title: r.title,
    abstract: r.abstract || "",
    url: r.doi || r.id,
    published_date: r.publication_date
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
    published_date: p.date
  }));
};

export const fetchOpenFDA = async () => {
  const res = await axios.get("/api/openfda");
  const results = res.data.results || [];
  
  return results.map((r: any) => ({
    source: "openfda",
    external_id: r.id,
    title: r.openfda?.brand_name?.[0] || "New Drug Label",
    abstract: r.indications_and_usage?.[0] || "Drug information from FDA",
    url: `https://labels.fda.gov/`,
    published_date: r.effective_time
  }));
};

export const fetchChEMBL = async () => {
  const res = await axios.get("/api/chembl");
  const molecules = res.data.molecules || [];
  
  return molecules.map((m: any) => ({
    source: "chembl",
    external_id: m.molecule_chembl_id,
    title: m.pref_name || m.molecule_chembl_id,
    abstract: `Molecular Formula: ${m.molecule_properties?.full_mwt || "N/A"}. Type: ${m.molecule_type}`,
    url: `https://www.ebi.ac.uk/chembl/compound_report_card/${m.molecule_chembl_id}/`,
    published_date: new Date().toISOString().split('T')[0]
  }));
};

export const fetchOrphanet = async () => {
  try {
    const res = await axios.get("/api/orphanet");
    const results = res.data.results || [];
    
    return results.map((r: any) => ({
      source: "orphanet",
      external_id: r.id,
      title: r.name || "Rare Disease Entry",
      abstract: r.description || "Information about rare diseases and orphan drugs.",
      url: `https://www.orpha.net/consor/cgi-bin/OC_Exp.php?lng=EN&Expert=${r.id}`,
      published_date: new Date().toISOString().split('T')[0]
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
      category: "medication",
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
      category: "medication",
      status: "pending",
      created_at: serverTimestamp(),
      reliability_score: 92,
      type: "guideline"
    },
    {
      source: "test_other",
      external_id: "test_3",
      title: "Some Other Article",
      abstract: "This is just some article that doesn't match the criteria.",
      url: "https://example.com/test_3",
      published_date: "2026-04-06",
      category: "other",
      status: "other",
      created_at: serverTimestamp(),
      reliability_score: 50,
      type: "other"
    }
  ];
  await saveArticles(testArticles);
};
