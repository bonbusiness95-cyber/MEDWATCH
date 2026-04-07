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

export type PaidSource = {
  name: string;
  reason: string;
};

export const rssSources: RSSSource[] = [
  { url: "https://www.ema.europa.eu/en/news.xml", name: "ema_rss", label: "EMA" },
  { url: "https://www.fda.gov/news-events/press-announcements/rss.xml", name: "fda_rss", label: "FDA" },
  { url: "https://www.nejm.org/rss/recent-articles", name: "nejm_rss", label: "NEJM" },
  { url: "https://www.thelancet.com/rssfeed/lancet_current.xml", name: "lancet_rss", label: "The Lancet" },
  { url: "https://www.nature.com/nm.rss", name: "nature_med_rss", label: "Nature Medicine" },
  { url: "https://feeds.bbci.co.uk/news/health/rss.xml", name: "bbc_health_rss", label: "BBC Health" },
  { url: "https://www.who.int/feeds/entity/csr/don/en/rss.xml", name: "who_don_rss", label: "WHO DON" },
  { url: "https://www.ecdc.europa.eu/en/news-events/rss", name: "ecdc_rss", label: "ECDC" },
  { url: "https://www.nih.gov/rss/news.xml", name: "nih_news_rss", label: "NIH News" },
  { url: "https://journals.plos.org/plosntds/feed/atom", name: "plos_ntd_rss", label: "PLOS NTD" },
  { url: "https://malariajournal.biomedcentral.com/articles/rss", name: "malaria_journal_rss", label: "Malaria Journal" },
  { url: "https://www.bmj.com/news/medical-research/rss.xml", name: "bmj_rss", label: "BMJ" },
  { url: "https://www.sciencedaily.com/rss/health_medicine.xml", name: "science_daily_health_rss", label: "ScienceDaily Health" },
  { url: "https://www.reuters.com/healthcare-pharmaceuticals/rss", name: "reuters_health_rss", label: "Reuters Health" }
];

export const scrapeSources: ScrapeSource[] = [
  {
    url: "https://www.who.int/news-room",
    name: "who_news",
    label: "WHO News",
    listSelector: "article",
    titleSelector: "h2 a, h3 a, h2",
    linkSelector: "a",
    descriptionSelector: "p",
    dateSelector: "time",
    baseUrl: "https://www.who.int"
  },
  {
    url: "https://www.orpha.net/consor/cgi-bin/Disease_Search.php?lng=EN&data=search",
    name: "orphanet_scrape",
    label: "Orphanet",
    listSelector: ".searchContent .item, .resultList article, .search-result",
    titleSelector: "a, h2, h3",
    linkSelector: "a",
    descriptionSelector: "p",
    dateSelector: "time",
    baseUrl: "https://www.orpha.net"
  }
];

export const paidSources: PaidSource[] = [
  { name: "Clarivate Web of Science", reason: "Requires subscription/API access from Clarivate." },
  { name: "Elsevier ScienceDirect API", reason: "Elsevier API access requires a paid subscription." },
  { name: "LexisNexis", reason: "Premium news database with paid access." },
  { name: "Bloomberg Health", reason: "Paid professional news and data feed." },
  { name: "UpToDate", reason: "Subscription-only medical content and clinical guidelines." }
];

export const allSourceLabels = [
  ...rssSources.map((s) => ({ source: s.name, label: s.label })),
  ...scrapeSources.map((s) => ({ source: s.name, label: s.label }))
];
