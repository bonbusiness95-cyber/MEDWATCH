/**
 * Configuration des sources médicales - Version 2.0 corrigée
 * Basé sur sources_medicales_config_corrige.json
 */

// Types détaillés pour les sources
export interface APISourceConfig {
  name: string;
  label: string;
  status: "corrigé" | "remplacé" | "partiellement_disponible" | "disponible_direct" | "bloqué";
  enabled: boolean;
  method: "REST" | "REST POST" | "GraphQL";
  endpoint: string;
  authentication?: {
    required: boolean;
    header_name?: string;
    note?: string;
  };
  rateLimit?: {
    requestsPerWindow: number;
    windowMinutes: number;
    delayBetweenRequests?: number;
  };
  headers?: Record<string, string>;
  parameters?: Record<string, string>;
  errorHandling?: Record<string, string>;
  fallback?: any;
  timeout?: number;
}

export interface RSSSourceConfig {
  name: string;
  label: string;
  status: "disponible_direct" | "remplacé" | "bloqué";
  enabled: boolean;
  url?: string;
  replacement?: {
    method: string;
    issn?: string;
    nlmTitle?: string;
    endpoint?: string;
  };
  fallback?: string;
}

// ======== API SOURCES CORRIGÉES ========
export const apiSourcesConfig: APISourceConfig[] = [
  {
    name: "semantic_scholar",
    label: "Semantic Scholar",
    status: "corrigé",
    enabled: true,
    method: "REST",
    endpoint: "https://api.semanticscholar.org/graph/v1/paper/search",
    authentication: {
      required: false,
      note: "Clé optionnelle mais recommandée pour limites plus hautes"
    },
    rateLimit: {
      requestsPerWindow: 100,
      windowMinutes: 5,
      delayBetweenRequests: 3
    },
    headers: {
      "Accept": "application/json",
      "User-Agent": "MEDWATCH/1.0 (medical@research.org)"
    },
    parameters: {
      query: "string (requis)",
      fields: "title,abstract,year,citationCount,authors",
      limit: "10"
    },
    errorHandling: {
      "429": "Attendre 60s et retry",
      "403": "Vérifier User-Agent et clé API"
    },
    timeout: 30
  },
  {
    name: "pubchem",
    label: "PubChem (fallback DrugBank)",
    status: "remplacé",
    enabled: true,
    method: "REST",
    endpoint: "https://pubchem.ncbi.nlm.nih.gov/rest/pug",
    authentication: { required: false },
    headers: {
      "Accept": "application/json"
    },
    timeout: 15
  },
  {
    name: "pharmgkb",
    label: "PharmGKB",
    status: "corrigé",
    enabled: true,
    method: "REST",
    endpoint: "https://api.pharmgkb.org/v1/data",
    authentication: { required: false },
    headers: {
      "Accept": "application/json",
      "User-Agent": "MEDWATCH/1.0"
    },
    errorHandling: {
      "404": "Retourner liste vide",
      "504": "Retry avec backoff"
    },
    timeout: 15
  },
  {
    name: "open_targets",
    label: "Open Targets",
    status: "corrigé",
    enabled: true,
    method: "GraphQL",
    endpoint: "https://api.platform.opentargets.org/api/v4/graphql",
    authentication: { required: false },
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    timeout: 30
  },
  {
    name: "rcsb_pdb",
    label: "RCSB PDB",
    status: "corrigé",
    enabled: true,
    method: "REST POST",
    endpoint: "https://search.rcsb.org/rcsbsearch/v2/query",
    authentication: { required: false },
    headers: {
      "Content-Type": "application/json"
    },
    timeout: 30
  },
  {
    name: "ema_spor",
    label: "EMA SPOR",
    status: "partiellement_disponible",
    enabled: true,
    method: "REST",
    endpoint: "https://spor.ema.europa.eu/rmswi/api/export",
    authentication: { required: false },
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; MEDWATCH/1.0)"
    },
    fallback: {
      organisations: "https://spor.ema.europa.eu/rmswi/api/export/organisations",
      substances: "https://spor.ema.europa.eu/rmswi/api/export/substances"
    },
    timeout: 30
  },
  {
    name: "who_iris",
    label: "WHO IRIS",
    status: "corrigé",
    enabled: true,
    method: "REST",
    endpoint: "https://iris.who.int/server/api/discover/search/objects",
    authentication: { required: false },
    timeout: 15
  },
  {
    name: "orphanet",
    label: "Orphanet",
    status: "corrigé",
    enabled: true,
    method: "REST",
    endpoint: "https://api.orphadata.com/api/v1",
    authentication: { required: false },
    fallback: {
      genes: "https://www.orphadata.com/data/xml/en_product6.xml",
      epidemiology: "https://www.orphadata.com/data/xml/en_product2.xml"
    },
    timeout: 10
  },
  {
    name: "crossref",
    label: "CrossRef",
    status: "corrigé",
    enabled: true,
    method: "REST",
    endpoint: "https://api.crossref.org/works",
    authentication: { required: false },
    rateLimit: {
      requestsPerWindow: 50,
      windowMinutes: 1
    },
    timeout: 15
  },
  {
    name: "unpaywall",
    label: "Unpaywall",
    status: "disponible_direct",
    enabled: true,
    method: "REST",
    endpoint: "https://api.unpaywall.org/v2",
    authentication: { required: false },
    rateLimit: {
      requestsPerWindow: 100000,
      windowMinutes: 1440 // 100k/jour
    },
    timeout: 10
  }
];

// ======== RSS SOURCES CORRIGÉES ========
export const rssSourcesConfig: RSSSourceConfig[] = [
  // RSS remplacés par PubMed API (ISSN)
  {
    name: "nejm_pubmed",
    label: "NEJM (via PubMed)",
    status: "remplacé",
    enabled: true,
    replacement: {
      method: "PubMed API",
      issn: "0028-4793",
      nlmTitle: "N Engl J Med",
      endpoint: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    }
  },
  {
    name: "jama_pubmed",
    label: "JAMA (via PubMed)",
    status: "remplacé",
    enabled: true,
    replacement: {
      method: "PubMed API",
      issn: "0098-7484",
      nlmTitle: "JAMA",
      endpoint: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    }
  },
  {
    name: "lancet_pubmed",
    label: "The Lancet (via PubMed)",
    status: "remplacé",
    enabled: true,
    replacement: {
      method: "PubMed API",
      issn: "0140-6736",
      nlmTitle: "Lancet",
      endpoint: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    }
  },
  {
    name: "bmj_pubmed",
    label: "BMJ (via PubMed)",
    status: "remplacé",
    enabled: true,
    replacement: {
      method: "PubMed API",
      issn: "0959-8138",
      nlmTitle: "BMJ",
      endpoint: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    }
  },
  {
    name: "cochrane_pubmed",
    label: "Cochrane Library (via PubMed)",
    status: "remplacé",
    enabled: true,
    replacement: {
      method: "PubMed API",
      issn: "1465-1858",
      nlmTitle: "Cochrane Database Syst Rev",
      endpoint: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    }
  },
  {
    name: "asco_pubmed",
    label: "ASCO/JCO (via PubMed)",
    status: "remplacé",
    enabled: true,
    replacement: {
      method: "PubMed API",
      issn: "1527-7755",
      nlmTitle: "J Clin Oncol",
      endpoint: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    }
  },
  {
    name: "esc_cardio_pubmed",
    label: "ESC Cardio (via PubMed)",
    status: "remplacé",
    enabled: true,
    replacement: {
      method: "PubMed API",
      issn: "0195-668X",
      nlmTitle: "Eur Heart J",
      endpoint: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
    }
  },
  // RSS encore disponibles directement
  {
    name: "eurosurveillance",
    label: "Eurosurveillance",
    status: "disponible_direct",
    enabled: true,
    url: "https://www.eurosurveillance.org/rss",
    fallback: "PubMed (ISSN: 1560-7917)"
  },
  {
    name: "eid_cdc",
    label: "Emerging Infectious Diseases (CDC)",
    status: "disponible_direct",
    enabled: true,
    url: "https://wwwnc.cdc.gov/eid/rss/etoc-rss",
    fallback: "PubMed (ISSN: 1080-6040)"
  },
  {
    name: "ecdc",
    label: "ECDC",
    status: "disponible_direct",
    enabled: true,
    url: "https://www.ecdc.europa.eu/en/publications-data/rss.xml"
  },
  {
    name: "nature_medicine",
    label: "Nature Medicine",
    status: "disponible_direct",
    enabled: true,
    url: "https://www.nature.com/nm.rss"
  }
];

// Configuration globale
export const globalConfig = {
  userAgent: "MEDWATCH/2.0 (medical@research.org)",
  defaultTimeout: 30,
  retryPolicy: {
    maxAttempts: 3,
    backoffMultiplier: 2,
    baseDelaySeconds: 5
  },
  rateLimiting: {
    pubmedEutils: "3 requêtes/seconde max",
    crossref: "50 requêtes/seconde",
    unpaywall: "100k requêtes/jour"
  },
  cache: {
    enabled: true,
    ttlSeconds: 3600
  }
};

// Export combiné
export const allMedicalSources = {
  apis: apiSourcesConfig.filter(s => s.enabled),
  rss: rssSourcesConfig.filter(s => s.enabled)
};
