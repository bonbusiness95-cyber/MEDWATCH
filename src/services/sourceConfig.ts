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

// API Sources
export const apiSources: APISource[] = [
  { name: "pubmed", label: "PubMed", endpoint: "https://api.ncbi.nlm.nih.gov/lit/ctxp" },
  { name: "clinical_trials", label: "ClinicalTrials.gov" },
  { name: "openfda", label: "openFDA" },
  { name: "ema_spor", label: "EMA SPOR" },
  { name: "who_iris", label: "WHO IRIS" },
  { name: "crossref", label: "CrossRef API" },
  { name: "semantic_scholar", label: "Semantic Scholar" },
  { name: "europe_pmc", label: "Europe PMC" },
  { name: "rxnorm", label: "RxNorm (NLM)" },
  { name: "drugbank", label: "DrugBank" },
  { name: "chembl", label: "ChEMBL" },
  { name: "uniprot", label: "UniProt" },
  { name: "omim", label: "OMIM" },
  { name: "orphanet", label: "Orphanet" },
  { name: "clinvar", label: "ClinVar" },
  { name: "pharmgkb", label: "PharmGKB" },
  { name: "disgenet", label: "DisGeNET" },
  { name: "open_targets", label: "Open Targets" },
  { name: "pdb_rcsb", label: "RCSB PDB" },
  { name: "geo_ncbi", label: "GEO Expression" }
];

// RSS Sources
export const rssSources: RSSSource[] = [
  { url: "https://www.nejm.org/rss/recent.xml", name: "nejm_rss", label: "NEJM" },
  { url: "https://www.thelancet.com/rssfeed/lancet_current.xml", name: "lancet_rss", label: "The Lancet" },
  { url: "https://jamanetwork.com/rss/site_5/67.xml", name: "jama_rss", label: "JAMA Network" },
  { url: "https://www.bmj.com/rss/recent.xml", name: "bmj_rss", label: "BMJ" },
  { url: "https://www.nature.com/nm.rss", name: "nature_med_rss", label: "Nature Medicine" },
  { url: "https://www.cell.com/rssFeed/medicine.xml", name: "cell_press_rss", label: "Cell Press" },
  { url: "https://stm.sciencemag.org/rss/current.xml", name: "sci_transl_med_rss", label: "Science Transl. Med." },
  { url: "https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml", name: "fda_rss", label: "FDA News" },
  { url: "https://www.ema.europa.eu/en/rss.xml", name: "ema_rss", label: "EMA News" },
  { url: "https://www.who.int/rss-feeds/news-english.xml", name: "who_rss", label: "WHO News" },
  { url: "https://ansm.sante.fr/rss.xml", name: "ansm_rss", label: "ANSM (France)" },
  { url: "https://clinicaltrials.gov/ct2/rss", name: "ct_gov_rss", label: "ClinicalTrials.gov RSS" },
  { url: "https://www.medscape.com/rssfeeds/public/features.xml", name: "medscape_rss", label: "Medscape" },
  { url: "https://www.medpagetoday.com/rss/headlines.xml", name: "medpage_today_rss", label: "MedPage Today" },
  { url: "https://www.asco.org/rss.xml", name: "asco_rss", label: "ASCO Daily News" },
  { url: "https://www.escardio.org/The-ESC/Press-Office/Press-releases/rss.xml", name: "esc_rss", label: "ESC Cardio" },
  { url: "https://www.cochranelibrary.com/rss/reviews.xml", name: "cochrane_rss", label: "Cochrane Library" },
  { url: "https://www.biomedcentral.com/rss", name: "bmc_rss", label: "BioMed Central" },
  { url: "https://journals.plos.org/plosmedicine/feed/atom", name: "plos_medicine_rss", label: "PLOS Medicine" },
  { url: "https://www.eurosurveillance.org/rss.xml", name: "eurosurveillance_rss", label: "Eurosurveillance" },
  { url: "https://www.cdc.gov/mmwr/rss.xml", name: "cdc_mmwr_rss", label: "CDC MMWR" },
  { url: "https://www.cdc.gov/eid/rss.xml", name: "eid_rss", label: "Emerging Infectious Diseases" },
  { url: "https://www.ecdc.europa.eu/en/rss.xml", name: "ecdc_rss", label: "ECDC" },
  { url: "https://www.pharmaceutical-journal.com/rss.xml", name: "pharm_journal_rss", label: "Pharmaceutical Journal" },
  { url: "https://www.fiercepharma.com/feed/", name: "fiercepharma_rss", label: "FiercePharma" }
];

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
