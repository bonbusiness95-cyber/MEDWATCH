import axios from "axios";
import admin from "firebase-admin";
import FeedParser from "feedparser";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { rssSources, scrapeSources } from "../src/services/sourceConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || "";
if (!firestoreDatabaseId) {
  try {
    const configPath = path.resolve(__dirname, "../firebase-applet-config.json");
    const configRaw = fs.readFileSync(configPath, "utf8");
    const config = JSON.parse(configRaw);
    firestoreDatabaseId = config.firestoreDatabaseId || "";
  } catch (error) {
    // Ignore if config file is unavailable or invalid
  }
}

let dbInstance: FirebaseFirestore.Firestore | null = null;
const getDb = () => {
  if (dbInstance) return dbInstance;

  const db = admin.firestore();
  if (firestoreDatabaseId) {
    db.settings({ databaseId: firestoreDatabaseId });
  }

  dbInstance = db;
  return db;
};

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

// Deduplicate articles before saving
const deduplicateAndSave = async (articles: any[]) => {
  let db;
  try {
    db = getDb();
  } catch (error) {
    console.warn("⚠️ Firebase not available, skipping article save");
    return { saved: 0, skipped: articles.length };
  }

  let saved = 0;
  let skipped = 0;

  for (const article of articles) {
    if (!article.title || !article.source) continue;

    // Classify the article but keep all collected articles visible in the dashboard.
    const classifiedArticle = classifyArticle(article);
    const status = "pending";

    try {
      let q = db.collection("articles").where("source", "==", article.source);
      if (article.external_id) {
        q = q.where("external_id", "==", article.external_id);
      } else {
        q = q.where("title", "==", article.title);
      }

      const snapshot = await q.get();

      if (snapshot.empty) {
        await db.collection("articles").add({
          ...classifiedArticle,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          status
        });
        saved++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`Error saving article "${article.title}":`, error);
    }
  }

  return { saved, skipped };
};

// PubMed
export const collectPubMed = async () => {
  const term = "all[sb]";

  try {
    const searchRes = await axios.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", {
      params: {
        db: "pubmed",
        term,
        reldate: 7,
        retmode: "json",
        retmax: 15
      }
    });

    const ids = searchRes.data.esearchresult?.idlist || [];
    if (!ids.length) return { source: "pubmed", saved: 0, skipped: 0 };

    const summaryRes = await axios.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi", {
      params: {
        db: "pubmed",
        id: ids.join(","),
        retmode: "json"
      }
    });

    const summaries = summaryRes.data.result || {};
    const articles = ids.map((id: string) => {
      const s = summaries[id] || {};
      return {
        source: "pubmed",
        external_id: id,
        title: s.title || "Untitled",
        abstract: s.abstract || "",
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        published_date: s.pubdate || new Date().toISOString(),
        type: "research"
      };
    });

    const result = await deduplicateAndSave(articles);
    console.log(`✅ PubMed: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "pubmed", ...result };
  } catch (error) {
    console.error("❌ PubMed error:", error);
    return { source: "pubmed", saved: 0, skipped: 0 };
  }
};

// ClinicalTrials.gov
export const collectClinicalTrials = async () => {
  try {
    const response = await axios.get("https://clinicaltrials.gov/api/v2/studies", {
      params: {
        "query.term": "all",
        pageSize: 15,
        sort: "LastUpdatePostDate:desc"
      },
      timeout: 10000
    });

    const studies = response.data.studies || [];
    const articles = studies.map((s: any) => ({
      source: "clinical_trials",
      external_id: s.protocolSection?.identificationModule?.nctId,
      title: s.protocolSection?.identificationModule?.officialTitle || 
             s.protocolSection?.identificationModule?.briefTitle || 
             "Clinical Trial",
      abstract: s.protocolSection?.descriptionModule?.briefSummary || "",
      url: `https://clinicaltrials.gov/study/${s.protocolSection?.identificationModule?.nctId}`,
      published_date: s.protocolSection?.statusModule?.lastUpdatePostDate || new Date().toISOString(),
      type: "clinical_trial"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ ClinicalTrials: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "clinical_trials", ...result };
  } catch (error) {
    console.error("❌ ClinicalTrials error:", error);
    return { source: "clinical_trials", saved: 0, skipped: 0 };
  }
};

// Europe PMC
export const collectEuropePMC = async () => {
  try {
    const response = await axios.get("https://www.ebi.ac.uk/europepmc/webservices/rest/search", {
      params: {
        query: "drug therapy treatment",
        format: "json",
        pageSize: 15,
        sort: "PUBLISH_DATE"
      },
      timeout: 10000
    });

    const results = response.data.resultList?.result || [];
    const articles = results.map((r: any) => ({
      source: "europe_pmc",
      external_id: r.id,
      title: r.title || "Article",
      abstract: r.abstractText || "",
      url: `https://europepmc.org/article/${r.source}/${r.id}`,
      published_date: r.firstPublicationDate || new Date().toISOString(),
      type: "research"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ Europe PMC: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "europe_pmc", ...result };
  } catch (error) {
    console.error("❌ Europe PMC error:", error);
    return { source: "europe_pmc", saved: 0, skipped: 0 };
  }
};

// RSS Sources
export const collectRSSSources = async () => {
  const allResults = { source: "rss", saved: 0, skipped: 0 };

  for (const source of rssSources) {
    try {
      const response = await axios.get(source.url, {
        headers: {
          'User-Agent': 'MedWatch-AI/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        timeout: 10000,
        responseType: 'stream'
      });

      const feedparser = new FeedParser({});
      const items: any[] = [];

      await new Promise((resolve, reject) => {
        response.data.pipe(feedparser);

        feedparser.on("readable", function() {
          let item;
          while (item = feedparser.read()) {
            items.push({
              source: source.name,
              external_id: item.guid || item.link,
              title: item.title || "Untitled",
              abstract: item.description || "",
              url: item.link,
              published_date: item.pubDate || new Date().toISOString(),
              type: "news"
            });
          }
        });

        feedparser.on("end", resolve);
        feedparser.on("error", reject);
      });

      const result = await deduplicateAndSave(items);
      console.log(`✅ RSS ${source.label}: saved ${result.saved}, skipped ${result.skipped}`);
      
      allResults.saved += result.saved;
      allResults.skipped += result.skipped;
    } catch (error) {
      console.error(`❌ RSS ${source.label} error:`, error);
    }
  }

  return allResults;
};

// Web Scraping
export const collectScrapeSources = async () => {
  const allResults = { source: "scrape", saved: 0, skipped: 0 };

  for (const source of scrapeSources) {
    try {
      const response = await axios.get(source.url, {
        headers: {
          'User-Agent': 'MedWatch-AI/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const items: any[] = [];

      $(source.listSelector).each((_, el) => {
        const titleEl = $(el).find(source.titleSelector);
        const linkEl = $(el).find(source.linkSelector);
        
        const title = titleEl.text().trim();
        let link = linkEl.attr("href") || "";
        const description = source.descriptionSelector ? 
          $(el).find(source.descriptionSelector).text().trim() : "";

        if (link && link.startsWith("/") && source.baseUrl) {
          link = source.baseUrl.replace(/\/$/, "") + link;
        }

        if (title && link) {
          items.push({
            source: source.name,
            external_id: link,
            title,
            abstract: description,
            url: link,
            published_date: new Date().toISOString(),
            type: "article"
          });
        }
      });

      const result = await deduplicateAndSave(items);
      console.log(`✅ Scrape ${source.label}: saved ${result.saved}, skipped ${result.skipped}`);
      
      allResults.saved += result.saved;
      allResults.skipped += result.skipped;
    } catch (error) {
      console.error(`❌ Scrape ${source.label} error:`, error);
    }
  }

  return allResults;
};

// OpenFDA
export const collectOpenFDA = async () => {
  try {
    const response = await axios.get("https://api.fda.gov/drug/label.json", {
      params: {
        limit: 10
      },
      timeout: 10000
    });

    const results = response.data.results || [];
    const articles = results.map((r: any) => ({
      source: "openfda",
      external_id: r.id || r.brand_name?.[0],
      title: `FDA Alert: ${r.brand_name?.[0] || "Drug"}`,
      abstract: r.adverse_reactions?.[0] || r.summary || "",
      url: "https://www.fda.gov/drugs",
      published_date: new Date().toISOString(),
      type: "alert"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ OpenFDA: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "openfda", ...result };
  } catch (error) {
    console.error("❌ OpenFDA error:", error);
    return { source: "openfda", saved: 0, skipped: 0 };
  }
};

// CrossRef
export const collectCrossRef = async () => {
  try {
    const response = await axios.get("https://api.crossref.org/works", {
      params: {
        rows: 15,
        sort: "published"
      },
      timeout: 10000
    });

    const items = response.data.message?.items || [];
    const articles = items.map((item: any) => ({
      source: "crossref",
      external_id: item.DOI,
      title: item.title?.[0] || "Research Article",
      abstract: item.abstract || "",
      url: `https://doi.org/${item.DOI}`,
      published_date: item.created?.["date-time"] || new Date().toISOString(),
      type: "research"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ CrossRef: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "crossref", ...result };
  } catch (error) {
    console.error("❌ CrossRef error:", error);
    return { source: "crossref", saved: 0, skipped: 0 };
  }
};

// Semantic Scholar
export const collectSemanticScholar = async () => {
  try {
    const requestConfig = {
      headers: {
        Accept: "application/json",
        "User-Agent": "MedicalAggregator/1.0 (research@institution.org)"
      },
      params: {
        limit: 15,
        fields: "title,abstract,url,year,citationCount,authors"
      },
      timeout: 15000
    };

    let response;
    try {
      response = await axios.get("https://api.semanticscholar.org/graph/v1/paper/search", requestConfig);
    } catch (firstError: any) {
      if (firstError.response?.status === 429) {
        await new Promise((resolve) => setTimeout(resolve, 60000));
        response = await axios.get("https://api.semanticscholar.org/graph/v1/paper/search", requestConfig);
      } else {
        throw firstError;
      }
    }

    const data = response.data.data || [];
    const articles = data.map((paper: any) => ({
      source: "semantic_scholar",
      external_id: paper.paperId,
      title: paper.title,
      abstract: paper.abstract || "",
      url: paper.url || `https://www.semanticscholar.org/paper/${paper.paperId}`,
      published_date: paper.year?.toString(),
      type: "research"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ Semantic Scholar: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "semantic_scholar", ...result };
  } catch (error) {
    console.error("❌ Semantic Scholar error:", error);
    return { source: "semantic_scholar", saved: 0, skipped: 0 };
  }
};

// ChEMBL
export const collectChEMBL = async () => {
  try {
    const response = await axios.get("https://www.ebi.ac.uk/chembl/api/data/molecule", {
      params: {
        format: "json",
        limit: 15
      },
      timeout: 10000
    });

    const molecules = response.data.molecules || [];
    const articles = molecules.map((mol: any) => ({
      source: "chembl",
      external_id: mol.molecule_chembl_id,
      title: `ChEMBL: ${mol.pref_name}`,
      abstract: mol.molecule_type || "",
      url: `https://www.ebi.ac.uk/chembl/compound/${mol.molecule_chembl_id}`,
      published_date: new Date().toISOString(),
      type: "compound"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ ChEMBL: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "chembl", ...result };
  } catch (error) {
    console.error("❌ ChEMBL error:", error);
    return { source: "chembl", saved: 0, skipped: 0 };
  }
};

// Orphanet
export const collectOrphanet = async () => {
  try {
    const response = await axios.get("https://api.orphadata.com/api/v1/rd-genes", {
      params: {
      },
      headers: {
        Accept: "application/json",
        "User-Agent": "MedicalAggregator/1.0"
      },
      timeout: 15000
    });

    const genes = response.data?.results || response.data?.items || response.data?.genes || response.data || [];
    const articles = (Array.isArray(genes) ? genes : [genes]).slice(0, 15).map((item: any) => ({
      source: "orphanet",
      external_id: item.id || item.geneId || item.name,
      title: item.name || item.Description || "Orphanet gene association",
      abstract: item.description || item.Summary || "",
      url: item.url || "https://www.orphadata.com/",
      published_date: new Date().toISOString(),
      type: "rare_disease"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ Orphanet: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "orphanet", ...result };
  } catch (error) {
    console.warn("⚠️ Orphanet JSON API failed, using XML fallback:", error);
    try {
      const xmlResponse = await axios.get("https://www.orphadata.com/data/xml/en_product6.xml", {
        headers: {
          Accept: "application/xml",
          "User-Agent": "MedicalAggregator/1.0"
        },
        timeout: 15000
      });

      const $ = cheerio.load(xmlResponse.data, { xmlMode: true });
      const disorders: any[] = [];

      $('Disorder').each((_, el) => {
        const id = $(el).find('OrphaCode').text().trim();
        const name = $(el).find('Name').text().trim();
        if (id && name) {
          disorders.push({
            source: "orphanet",
            external_id: id,
            title: name,
            abstract: $(el).find('TypeOfRareDisease').text().trim() || "",
            url: `https://www.orphadata.com/land/${id}`,
            published_date: new Date().toISOString(),
            type: "rare_disease"
          });
        }
      });

      const result = await deduplicateAndSave(disorders.slice(0, 15));
      console.log(`✅ Orphanet XML fallback: saved ${result.saved}, skipped ${result.skipped}`);
      return { source: "orphanet", ...result };
    } catch (fallbackError) {
      console.error("❌ Orphanet error:", fallbackError);
      return { source: "orphanet", saved: 0, skipped: 0 };
    }
  }
};

// DrugBank
export const collectDrugBank = async () => {
  try {
    const searchResponse = await axios.get("https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/treatment/cids/JSON", {
      headers: {
        Accept: "application/json",
        "User-Agent": "MedicalAggregator/1.0"
      },
      timeout: 15000
    });

    const cids = searchResponse.data?.IdentifierList?.CID || [];
    const articles: any[] = [];

    for (const cid of cids.slice(0, 10)) {
      try {
        const propertiesResponse = await axios.get(
          `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IUPACName,MolecularFormula,MolecularWeight/JSON`,
          {
            headers: {
              Accept: "application/json",
              "User-Agent": "MedicalAggregator/1.0"
            },
            timeout: 15000
          }
        );

        const props = propertiesResponse.data?.PropertyTable?.Properties?.[0] || {};
        articles.push({
          source: "drugbank",
          external_id: `pubchem-${cid}`,
          title: props.IUPACName || `PubChem Compound ${cid}`,
          abstract: `Formula: ${props.MolecularFormula || "n/a"}, MW: ${props.MolecularWeight || "n/a"}`,
          url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`,
          published_date: new Date().toISOString(),
          type: "compound"
        });
      } catch (innerError) {
        console.warn(`DrugBank PubChem fallback failed for CID ${cid}:`, innerError);
      }
    }

    const result = await deduplicateAndSave(articles.slice(0, 15));
    console.log(`✅ DrugBank: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "drugbank", ...result };
  } catch (error) {
    console.error("❌ DrugBank error:", error);
    return { source: "drugbank", saved: 0, skipped: 0 };
  }
};

// RxNorm
export const collectRxNorm = async () => {
  try {
    const response = await axios.get("https://rxnav.nlm.nih.gov/REST/drugs.json", {
      params: {
        name: "treatment"
      },
      timeout: 10000
    });

    const drugGroup = response.data?.drugGroup || {};
    const conceptGroup = drugGroup.conceptGroup || [];
    const articles = conceptGroup.slice(0, 15).map((group: any) => ({
      source: "rxnorm",
      external_id: group.conceptProperties?.[0]?.rxcui,
      title: group.conceptProperties?.[0]?.name || "RxNorm Drug",
      abstract: `RxNorm concept: ${group.tty}`,
      url: `https://rxnav.nlm.nih.gov/REST/rxcui/${group.conceptProperties?.[0]?.rxcui}`,
      published_date: new Date().toISOString(),
      type: "drug_concept"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ RxNorm: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "rxnorm", ...result };
  } catch (error) {
    console.error("❌ RxNorm error:", error);
    return { source: "rxnorm", saved: 0, skipped: 0 };
  }
};

// UniProt
export const collectUniProt = async () => {
  try {
    const response = await axios.get("https://rest.uniprot.org/uniprotkb/search", {
      params: {
        query: "medical AND reviewed:true",
        size: 15,
        format: "json"
      },
      timeout: 10000
    });

    const results = response.data.results || [];
    const articles = results.map((protein: any) => ({
      source: "uniprot",
      external_id: protein.primaryAccession,
      title: protein.proteinDescription?.recommendedName?.fullName?.value || protein.primaryAccession,
      abstract: protein.proteinDescription?.recommendedName?.fullName?.value || "",
      url: `https://www.uniprot.org/uniprotkb/${protein.primaryAccession}`,
      published_date: new Date().toISOString(),
      type: "protein"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ UniProt: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "uniprot", ...result };
  } catch (error) {
    console.error("❌ UniProt error:", error);
    return { source: "uniprot", saved: 0, skipped: 0 };
  }
};

// OMIM
export const collectOMIM = async () => {
  try {
    // OMIM requires API key, using public search page
    const response = await axios.get("https://www.omim.org/search", {
      params: {
        search: "treatment",
        retrieve: "entry",
        sort: "created_date",
        limit: 15
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const entries: any[] = [];

    $('.entry, .result-item').each((_, el) => {
      const title = $(el).find('h3, .title').text().trim();
      const link = $(el).find('a').attr('href');
      const mimNumber = link ? link.match(/\/entry\/(\d+)/)?.[1] : null;

      if (title && mimNumber) {
        entries.push({
          source: "omim",
          external_id: mimNumber,
          title: title,
          abstract: "OMIM genetic entry",
          url: `https://www.omim.org/entry/${mimNumber}`,
          published_date: new Date().toISOString(),
          type: "genetic"
        });
      }
    });

    const result = await deduplicateAndSave(entries.slice(0, 15));
    console.log(`✅ OMIM: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "omim", ...result };
  } catch (error) {
    console.error("❌ OMIM error:", error);
    return { source: "omim", saved: 0, skipped: 0 };
  }
};

// ClinVar
export const collectClinVar = async () => {
  try {
    const response = await axios.get("https://www.ncbi.nlm.nih.gov/clinvar/", {
      params: {
        term: "treatment",
        limit: 15
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const variants: any[] = [];

    $('.variant-card, .result-item').each((_, el) => {
      const title = $(el).find('h3, .variant-name').text().trim();
      const link = $(el).find('a').attr('href');
      const accession = link ? link.match(/variation\/([^/?]+)/)?.[1] : null;

      if (title && accession) {
        variants.push({
          source: "clinvar",
          external_id: accession,
          title: title,
          abstract: "ClinVar variant entry",
          url: `https://www.ncbi.nlm.nih.gov/clinvar/variation/${accession}`,
          published_date: new Date().toISOString(),
          type: "variant"
        });
      }
    });

    const result = await deduplicateAndSave(variants.slice(0, 15));
    console.log(`✅ ClinVar: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "clinvar", ...result };
  } catch (error) {
    console.error("❌ ClinVar error:", error);
    return { source: "clinvar", saved: 0, skipped: 0 };
  }
};

// PharmGKB
export const collectPharmGKB = async () => {
  try {
    let chemicals: any[] = [];
    try {
      const response = await axios.get("https://api.pharmgkb.org/v1/data/chemical/", {
        params: {
          name: "treatment"
        },
        headers: {
          Accept: "application/json",
          "User-Agent": "MedicalAggregator/1.0"
        },
        timeout: 15000
      });
      chemicals = response.data?.data || response.data || [];
    } catch (apiError: any) {
      if (apiError.response?.status === 404) {
        const fallbackResponse = await axios.get("https://api.pharmgkb.org/v1/data/chemical?name=aspirin", {
          headers: {
            Accept: "application/json",
            "User-Agent": "MedicalAggregator/1.0"
          },
          timeout: 15000
        });
        chemicals = fallbackResponse.data?.data || fallbackResponse.data || [];
      } else {
        throw apiError;
      }
    }

    const articles = (Array.isArray(chemicals) ? chemicals : [chemicals]).slice(0, 15).map((chem: any) => ({
      source: "pharmgkb",
      external_id: chem.id || chem.name,
      title: chem.name || chem.id || "PharmGKB Chemical",
      abstract: chem.description || chem.synonyms?.join(", ") || "",
      url: chem.id ? `https://www.pharmgkb.org/chemical/${chem.id}` : "https://www.pharmgkb.org/",
      published_date: new Date().toISOString(),
      type: "chemical"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ PharmGKB: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "pharmgkb", ...result };
  } catch (error) {
    console.error("❌ PharmGKB error:", error);
    return { source: "pharmgkb", saved: 0, skipped: 0 };
  }
};

// DisGeNET
export const collectDisGeNET = async () => {
  try {
    const response = await axios.get("https://www.disgenet.org/search", {
      params: {
        q: "treatment",
        limit: 15
      },
      timeout: 10000
    });

    const $ = cheerio.load(response.data);
    const associations: any[] = [];

    $('.gene-disease, .result-item').each((_, el) => {
      const title = $(el).find('h3, .gene-name').text().trim();
      const link = $(el).find('a').attr('href');

      if (title && link) {
        const geneId = link.match(/\/browser\/[^/]+\/[^/]+\/[^/]+\/(\d+)/)?.[1];
        if (geneId) {
          associations.push({
            source: "disgenet",
            external_id: geneId,
            title: `Gene-Disease: ${title}`,
            abstract: "Gene-disease association",
            url: `https://www.disgenet.org/browser/0/1/0/${geneId}/summary`,
            published_date: new Date().toISOString(),
            type: "gene_disease"
          });
        }
      }
    });

    const result = await deduplicateAndSave(associations.slice(0, 15));
    console.log(`✅ DisGeNET: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "disgenet", ...result };
  } catch (error) {
    console.error("❌ DisGeNET error:", error);
    return { source: "disgenet", saved: 0, skipped: 0 };
  }
};

// Open Targets
export const collectOpenTargets = async () => {
  try {
    const response = await axios.post(
      "https://api.platform.opentargets.org/api/v4/graphql",
      {
        query: `query TargetDetails($ensemblId: String!) { target(ensemblId: $ensemblId) { id approvedSymbol approvedName biotype associatedDiseases(page: {index: 0, size: 25}) { rows { disease { id name } score } } } }`,
        variables: {
          ensemblId: "ENSG00000133703"
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "MedicalAggregator/1.0"
        },
        timeout: 15000
      }
    );

    const target = response.data.data?.target;
    const diseaseRows = target?.associatedDiseases?.rows || [];
    const articles = diseaseRows.slice(0, 15).map((row: any) => ({
      source: "open_targets",
      external_id: row.disease?.id || target.id,
      title: `${target.approvedSymbol || target.id} — ${row.disease?.name}`,
      abstract: `Target ${target.approvedName || target.approvedSymbol} linked to ${row.disease?.name} (score ${row.score})`,
      url: `https://platform.opentargets.org/target/${target.id}`,
      published_date: new Date().toISOString(),
      type: "target_disease"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ Open Targets: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "open_targets", ...result };
  } catch (error) {
    console.error("❌ Open Targets error:", error);
    return { source: "open_targets", saved: 0, skipped: 0 };
  }
};

// RCSB PDB
export const collectRCSBPDB = async () => {
  try {
    const response = await axios.post(
      "https://search.rcsb.org/rcsbsearch/v2/query",
      {
        query: {
          type: "terminal",
          service: "text",
          parameters: {
            attribute: "struct.title",
            operator: "contains_words",
            value: "treatment"
          }
        },
        return_type: "entry",
        request_options: {
          paginate: {
            start: 0,
            rows: 15
          },
          sort: [
            {
              sort_by: "score",
              direction: "desc"
            }
          ]
        }
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "MedicalAggregator/1.0"
        },
        timeout: 15000
      }
    );

    const results = response.data.result_set || [];
    const articles = results.map((entry: any) => ({
      source: "pdb_rcsb",
      external_id: entry.identifier,
      title: entry.title || `PDB ${entry.identifier}`,
      abstract: entry.description || "",
      url: `https://www.rcsb.org/structure/${entry.identifier}`,
      published_date: new Date().toISOString(),
      type: "structure"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ RCSB PDB: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "pdb_rcsb", ...result };
  } catch (error) {
    console.error("❌ RCSB PDB error:", error);
    return { source: "pdb_rcsb", saved: 0, skipped: 0 };
  }
};

// GEO NCBI
export const collectGEONCBI = async () => {
  try {
    const response = await axios.get("https://www.ncbi.nlm.nih.gov/geo/browse/", {
      params: {
        view: "series",
        search: "treatment",
        zsort: "date",
        mode: "json"
      },
      timeout: 10000
    });

    const series = response.data?.series || [];
    const articles = series.slice(0, 15).map((s: any) => ({
      source: "geo_ncbi",
      external_id: s.accession,
      title: s.title || `GEO ${s.accession}`,
      abstract: s.summary || "",
      url: `https://www.ncbi.nlm.nih.gov/geo/query/acc.cgi?acc=${s.accession}`,
      published_date: s.pdat || new Date().toISOString(),
      type: "expression"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ GEO NCBI: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "geo_ncbi", ...result };
  } catch (error) {
    console.error("❌ GEO NCBI error:", error);
    return { source: "geo_ncbi", saved: 0, skipped: 0 };
  }
};

// EMA SPOR - using public export endpoint when available
export const collectEMASPOR = async () => {
  try {
    const response = await axios.get("https://spor.ema.europa.eu/rmswi/api/export/medicinal_products", {
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; MedicalBot/1.0)"
      },
      timeout: 20000
    });

    const products = Array.isArray(response.data)
      ? response.data
      : response.data?.items || response.data?.results || [];

    const articles = (Array.isArray(products) ? products : []).slice(0, 15).map((product: any) => ({
      source: "ema_spor",
      external_id: product.id || product.medicinalProductId || product.name,
      title: product.name || product.medicinalProductName || "EMA SPOR Product",
      abstract: product.description || product.medicinalProductDescription || "EMA medicinal product",
      url: product.url || "https://spor.ema.europa.eu",
      published_date: new Date().toISOString(),
      type: "medicinal_product"
    }));

    const result = await deduplicateAndSave(articles);
    console.log(`✅ EMA SPOR: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "ema_spor", ...result };
  } catch (error) {
    console.warn("⚠️ EMA SPOR export failed, falling back to web search:", error);
    try {
      const response = await axios.get("https://www.ema.europa.eu/en/search", {
        params: {
          q: "treatment",
          type: "medicinal_product"
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const products: any[] = [];

      $('.search-result, article').each((_, el) => {
        const title = $(el).find('h2, h3').text().trim();
        const link = $(el).find('a').attr('href');

        if (title && link) {
          products.push({
            source: "ema_spor",
            external_id: link.split('/').pop(),
            title: title,
            abstract: "EMA medicinal product",
            url: link.startsWith('http') ? link : `https://www.ema.europa.eu${link}`,
            published_date: new Date().toISOString(),
            type: "drug"
          });
        }
      });

      const result = await deduplicateAndSave(products.slice(0, 15));
      console.log(`✅ EMA SPOR fallback: saved ${result.saved}, skipped ${result.skipped}`);
      return { source: "ema_spor", ...result };
    } catch (fallbackError) {
      console.error("❌ EMA SPOR error:", fallbackError);
      return { source: "ema_spor", saved: 0, skipped: 0 };
    }
  }
};

// WHO IRIS
export const collectWHOIRIS = async () => {
  try {
    const response = await axios.get("https://iris.who.int/server/api/discover/search/objects", {
      params: {
        query: "treatment",
        page: 0,
        size: 15
      },
      headers: {
        Accept: "application/json",
        "User-Agent": "MedicalAggregator/1.0"
      },
      timeout: 15000
    });

    const items = response.data?._embedded?.items || response.data?.items || response.data?.objects || [];
    const publications = (Array.isArray(items) ? items : []).slice(0, 15).map((item: any) => ({
      source: "who_iris",
      external_id: item.id || item.handle || item.metadata?.dc_identifier || item?.uri,
      title: item?.metadata?.dc_title || item?.name || "WHO IRIS publication",
      abstract: item?.metadata?.dc_description || item?.description || "",
      url: item?.uri || `https://iris.who.int/handle/${item.handle}`,
      published_date: item?.metadata?.dc_date || new Date().toISOString(),
      type: "publication"
    }));

    const result = await deduplicateAndSave(publications);
    console.log(`✅ WHO IRIS: saved ${result.saved}, skipped ${result.skipped}`);
    return { source: "who_iris", ...result };
  } catch (error) {
    console.error("❌ WHO IRIS error:", error);
    return { source: "who_iris", saved: 0, skipped: 0 };
  }
};

// Main collection function
export const runBackgroundCollection = async () => {
  // Check if Firebase is available
  try {
    getDb();
  } catch (error) {
    console.warn("⚠️ Firebase not available, skipping background collection");
    return { totalSaved: 0, totalSkipped: 0, duration: "0.00" };
  }

  const startTime = Date.now();
  console.log("\n📡 Starting background medical watch collection...");

  const results = await Promise.all([
    // Core medical sources
    collectPubMed(),
    collectClinicalTrials(),
    collectEuropePMC(),
    collectOpenFDA(),

    // Research databases
    collectCrossRef(),
    collectSemanticScholar(),

    // Drug & compound databases
    collectChEMBL(),
    collectDrugBank(),
    collectRxNorm(),

    // Genetic & protein databases
    collectUniProt(),
    collectOMIM(),
    collectClinVar(),

    // Pharmacogenomics & disease
    collectPharmGKB(),
    collectDisGeNET(),
    collectOpenTargets(),

    // Structural biology
    collectRCSBPDB(),
    collectGEONCBI(),

    // Regulatory agencies
    collectEMASPOR(),
    collectWHOIRIS(),
    collectOrphanet(),

    // News & RSS feeds (all sources)
    collectRSSSources(),

    // Web scraping (all sources)
    collectScrapeSources()
  ]);

  const totalSaved = results.reduce((sum, r) => sum + (r.saved || 0), 0);
  const totalSkipped = results.reduce((sum, r) => sum + (r.skipped || 0), 0);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n✅ Collection complete in ${duration}s`);
  console.log(`📊 Total: ${totalSaved} saved, ${totalSkipped} skipped`);
  console.log("\n📋 Detailed Results:");
  results.forEach((r: any) => {
    if (r.saved > 0 || r.skipped > 0) {
      const status = r.saved > 0 ? "✅" : "⏭️ ";
      console.log(`   ${status} ${r.source}: ${r.saved} saved, ${r.skipped} skipped`);
    }
  });
  console.log("=====================================\n");

  return { totalSaved, totalSkipped, duration };
};
