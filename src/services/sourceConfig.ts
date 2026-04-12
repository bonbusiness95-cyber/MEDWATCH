export type Source = {
  name: string;
  label: string;
  category: "api" | "rss" | "scrape";
  icon: string;
  color: string;
};

export type RSSSource = {
  url: string;
  name: string;
  label: string;
};

export type ScrapeSource = {
  url: string;
  name: string;
  label: string;
  listSelector: string;
  titleSelector: string;
  linkSelector: string;
  descriptionSelector?: string;
  dateSelector?: string;
  baseUrl?: string;
};

export type APISource = {
  name: string;
  label: string;
  endpoint?: string;
};

export type PaidSource = {
  name: string;
  reason: string;
};

// API Sources - Version 2.0 corrigée
export const apiSources: APISource[] = [
  // Sources médicales de base (fonctionnelles)
  { name: "pubmed", label: "PubMed", endpoint: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/" },
  { name: "clinical_trials", label: "ClinicalTrials.gov", endpoint: "https://clinicaltrials.gov/api/v2/studies" },
  { name: "openfda", label: "openFDA", endpoint: "https://api.fda.gov/drug/label.json" },
  { name: "europe_pmc", label: "Europe PMC", endpoint: "https://www.ebi.ac.uk/europepmc/webservices/rest/" },
  
  // Sources corrigées (v2.0)
  { name: "semantic_scholar", label: "Semantic Scholar", endpoint: "/api/semantic-scholar" },
  { name: "pubchem", label: "PubChem (fallback DrugBank)", endpoint: "/api/pubchem/search" },
  { name: "pharmgkb", label: "PharmGKB", endpoint: "/api/pharmgkb" },
  { name: "open_targets", label: "Open Targets", endpoint: "/api/open-targets" },
  { name: "rcsb_pdb", label: "RCSB PDB", endpoint: "/api/rcsb-pdb" },
  { name: "who_iris", label: "WHO IRIS", endpoint: "/api/who-iris" },
  { name: "ema_spor", label: "EMA SPOR", endpoint: "/api/ema-spor" },
  { name: "orphanet", label: "Orphanet", endpoint: "/api/orphanet" },
  { name: "crossref", label: "CrossRef", endpoint: "/api/crossref" },
  { name: "unpaywall", label: "Unpaywall", endpoint: "/api/unpaywall" },
  
  // Sources additionnelles
  { name: "chembl", label: "ChEMBL", endpoint: "https://www.ebi.ac.uk/chembl/api/data/" },
  { name: "uniprot", label: "UniProt", endpoint: "https://rest.uniprot.org/uniprotkb/" },
  { name: "omim", label: "OMIM" },
  { name: "clinvar", label: "ClinVar" },
  { name: "disgenet", label: "DisGeNET" },
  { name: "geo_ncbi", label: "GEO Expression" }
];

// RSS Sources - Version vérifiée et fonctionnelle
export const rssSources: RSSSource[] = [
  // ✅ SOURCES RSS FONCTIONNELLES VÉRIFIÉES
  { url: "https://www.nature.com/nm.rss", name: "nature_med_rss", label: "Nature Medicine" },
  { url: "https://www.bmj.com/rss/recent.xml", name: "bmj_rss", label: "BMJ" },
  { url: "https://journals.plos.org/plosmedicine/feed/atom", name: "plos_medicine_rss", label: "PLOS Medicine" },
  { url: "https://www.cdc.gov/mmwr/rss/mmwr.xml", name: "cdc_mmwr_rss", label: "CDC MMWR" },
  { url: "https://www.eurosurveillance.org/rss.xml", name: "eurosurveillance_rss", label: "Eurosurveillance" },
  
  // 📡 SOURCES VIA PUBMED API (fallback RSS bloqués)
  { url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=nejm[Journal]+AND+last+7+days[PDat]&retmode=json&retmax=10", name: "nejm_pubmed", label: "NEJM (via PubMed)" },
  { url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=lancet[Journal]+AND+last+7+days[PDat]&retmode=json&retmax=10", name: "lancet_pubmed", label: "The Lancet (via PubMed)" },
  { url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=jama[Journal]+AND+last+7+days[PDat]&retmode=json&retmax=10", name: "jama_pubmed", label: "JAMA (via PubMed)" },
  
  // ⚠️ SOURCES RSS À REMPLACER PAR SCRAPING/API
  // Ces sources sont protégées par Cloudflare/DataDome
  // Solution: Utiliser /api/scrape/source ou PubMed API
  { url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml", name: "fda_rss", label: "FDA News (RSS officiel)" },
  { url: "https://www.who.int/rss-feeds/news-english.xml", name: "who_rss", label: "WHO News (RSS officiel)" },
  { url: "https://www.ema.europa.eu/en/news.xml", name: "ema_rss", label: "EMA News (RSS officiel)" },
  
  // 🔴 SOURCES BLOQUÉES (à éviter)
  // Medscape, ASCO, Lancet direct, Cell Press - protégés
];

// Configuration pour le scraping de sites médicaux protégés
export const scrapeSiteConfigs = {
  fda: {
    url: "https://www.fda.gov/news-events/press-announcements",
    listSelector: ".view-content .views-row, .news-item, article",
    titleSelector: "h2 a, h3 a, .title a",
    linkSelector: "a",
    descriptionSelector: ".summary, .description, p",
    baseUrl: "https://www.fda.gov",
    note: "Site protégé - utiliser avec précaution"
  },
  who: {
    url: "https://www.who.int/news",
    listSelector: ".sf-news-item, article, .news-item",
    titleSelector: "h2 a, h3 a, .title a",
    linkSelector: "a",
    descriptionSelector: ".summary, p",
    baseUrl: "https://www.who.int",
    note: "Site protégé par Cloudflare"
  },
  nejm: {
    url: "https://www.nejm.org/medical-articles/recent",
    listSelector: ".article-item, .search-results-item",
    titleSelector: "h2 a, h3 a, .title a",
    linkSelector: "a",
    descriptionSelector: ".abstract, .summary, p",
    baseUrl: "https://www.nejm.org",
    note: "Site protégé - privilégier PubMed API"
  },
  lancet: {
    url: "https://www.thelancet.com/journals/lancet/issue/current",
    listSelector: "article, .article-summary",
    titleSelector: "h2 a, h3 a",
    linkSelector: "a",
    descriptionSelector: ".summary, p",
    baseUrl: "https://www.thelancet.com",
    note: "Elsevier protection - privilégier PubMed API"
  }
};

// Scrape Sources
export const scrapeSources: ScrapeSource[] = [
  {
    url: "https://www.fda.gov/news-events",
    name: "fda_scrape",
    label: "FDA (Press Releases)",
    listSelector: ".search-result, article",
    titleSelector: "h2 a, h3 a",
    linkSelector: "a",
    baseUrl: "https://www.fda.gov"
  },
  {
    url: "https://www.ema.europa.eu/en/news",
    name: "ema_scrape",
    label: "EMA (News)",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.ema.europa.eu"
  },
  {
    url: "https://www.who.int/news",
    name: "who_scrape",
    label: "WHO (News)",
    listSelector: "article, .news-item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.who.int"
  },
  {
    url: "https://ansm.sante.fr",
    name: "ansm_scrape",
    label: "ANSM (France)",
    listSelector: ".article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://ansm.sante.fr"
  },
  {
    url: "https://www.nejm.org",
    name: "nejm_scrape",
    label: "NEJM (Abstracts)",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.nejm.org"
  },
  {
    url: "https://www.thelancet.com",
    name: "lancet_scrape",
    label: "The Lancet",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.thelancet.com"
  },
  {
    url: "https://jamanetwork.com",
    name: "jama_scrape",
    label: "JAMA Network",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://jamanetwork.com"
  },
  {
    url: "https://www.bmj.com",
    name: "bmj_scrape",
    label: "BMJ",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.bmj.com"
  },
  {
    url: "https://www.nature.com/nm",
    name: "nature_med_scrape",
    label: "Nature Medicine",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.nature.com/nm"
  },
  {
    url: "https://www.cell.com",
    name: "cell_scrape",
    label: "Cell Press",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.cell.com"
  },
  {
    url: "https://escardio.org/guidelines",
    name: "esc_scrape",
    label: "ESC Guidelines",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://escardio.org"
  },
  {
    url: "https://meeting.asco.org",
    name: "asco_scrape",
    label: "ASCO Abstracts",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://meeting.asco.org"
  },
  {
    url: "https://www.idsociety.org/guidelines",
    name: "idsa_scrape",
    label: "IDSA Guidelines",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.idsociety.org"
  },
  {
    url: "https://www.cochranelibrary.com",
    name: "cochrane_scrape",
    label: "Cochrane Library",
    listSelector: "article, .item",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.cochranelibrary.com"
  },
  {
    url: "https://www.tripdatabase.com",
    name: "trip_scrape",
    label: "Trip Database",
    listSelector: ".result, article",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.tripdatabase.com"
  },
  {
    url: "https://www.mdcalc.com",
    name: "mdcalc_scrape",
    label: "MDCalc",
    listSelector: ".result, article",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://www.mdcalc.com"
  },
  {
    url: "https://dailymed.nlm.nih.gov",
    name: "dailymed_scrape",
    label: "DailyMed",
    listSelector: ".result, article",
    titleSelector: "h2, h3",
    linkSelector: "a",
    baseUrl: "https://dailymed.nlm.nih.gov"
  }
];

export const paidSources: PaidSource[] = [
  { name: "UpToDate", reason: "Subscription-only clinical content" },
  { name: "Medscape Premium", reason: "Requires professional subscription" },
  { name: "Clarivate Web of Science", reason: "Paid academic database" }
];

// Combined source list for the dashboard
export const allSources: Source[] = [
  ...apiSources.map((s) => ({ name: s.name, label: s.label, category: "api" as const, icon: "🔌", color: "blue" })),
  ...rssSources.map((s) => ({ name: s.name, label: s.label, category: "rss" as const, icon: "📡", color: "green" })),
  ...scrapeSources.map((s) => ({ name: s.name, label: s.label, category: "scrape" as const, icon: "🕷️", color: "amber" }))
];

export const sourcesByCategory = {
  api: apiSources,
  rss: rssSources,
  scrape: scrapeSources
};

export const allSourceLabels = allSources.map((s) => ({ source: s.name, label: s.label }));
