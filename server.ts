import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import FeedParser from "feedparser";
import * as cheerio from "cheerio";
import fs from "fs";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { createRequire } from "module";
import { runBackgroundCollection } from "./server/backgroundCollector.js";

// Set up __dirname and __filename for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config();

// Initialize Firebase Admin
const requireModule = createRequire(import.meta.url);
let firebaseInitialized = false;

console.log("🔧 Initializing Firebase...");
console.log("   FIREBASE_SERVICE_ACCOUNT_JSON:", process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? "✅ SET (length: " + process.env.FIREBASE_SERVICE_ACCOUNT_JSON.length + ")" : "❌ NOT SET");
console.log("   FIREBASE_SERVICE_ACCOUNT_PATH:", process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "default");

try {
  // Try environment variable first (for Render deployment)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.log("📝 Parsing FIREBASE_SERVICE_ACCOUNT_JSON...");
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    console.log("✅ JSON parsed successfully");
    console.log("   Project ID:", serviceAccount.project_id);
    const credential = admin.credential.cert(serviceAccount);
    admin.initializeApp({ credential });
    firebaseInitialized = true;
    console.log("✅ Firebase Admin initialized from environment variable");
  } else {
    console.log("📁 Trying to load from file...");
    // Fallback to file
    const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./firebase-service-account.json");
    console.log("   Path:", serviceAccountPath);
    const serviceAccount = requireModule(serviceAccountPath);
    console.log("✅ Service account file loaded");
    console.log("   Project ID:", serviceAccount.project_id);
    const credential = admin.credential.cert(serviceAccount);
    admin.initializeApp({ credential });
    firebaseInitialized = true;
    console.log("✅ Firebase Admin initialized from file");
  }

  let firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || "";
  if (!firestoreDatabaseId) {
    try {
      const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
      const configRaw = fs.readFileSync(configPath, "utf8");
      const config = JSON.parse(configRaw);
      firestoreDatabaseId = config.firestoreDatabaseId || "";
    } catch (error) {
      // No database ID configured in the client app config.
    }
  }

  if (firebaseInitialized && firestoreDatabaseId) {
    try {
      console.log("🔧 Setting Firestore databaseId:", firestoreDatabaseId);
      admin.firestore().settings({ databaseId: firestoreDatabaseId });
    } catch (error) {
      console.warn("⚠️ Failed to set Firestore databaseId:", error.message);
    }
  }
} catch (error) {
  console.warn("⚠️ Firebase Admin not initialized - background collection will not work");
  console.warn("Set FIREBASE_SERVICE_ACCOUNT_JSON environment variable with service account JSON, or ensure firebase-service-account.json exists");
  console.warn("Error details:", error.message);
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Diagnostic endpoint
  app.get("/api/diagnostic", async (req, res) => {
    try {
      let firebaseStatus = "❌ NOT INITIALIZED";
      let articlesCount = 0;
      
      if (firebaseInitialized) {
        firebaseStatus = "✅ INITIALIZED";
        try {
          const snapshot = await admin.firestore().collection("articles").get();
          articlesCount = snapshot.size;
        } catch (e: any) {
          firebaseStatus = "⚠️ INITIALIZED BUT CANNOT ACCESS DATA: " + e.message;
        }
      }

      res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        firebase: firebaseStatus,
        articlesInDatabase: articlesCount,
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          PORT: process.env.PORT,
          FIREBASE_SERVICE_ACCOUNT_JSON_SET: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON
        }
      });
    } catch (error: any) {
      res.status(500).json({
        status: "error",
        error: error.message
      });
    }
  });

  // Manual trigger for collection (for testing)
  app.post("/api/admin/collect", async (req, res) => {
    try {
      console.log("🚀 Manual collection triggered");
      const result = await runBackgroundCollection();
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Collection error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Routes
  
  // Proxy for PubMed
  app.get("/api/pubmed/search", async (req, res) => {
    try {
      const { term, reldate } = req.query;
      const response = await axios.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi", {
        params: {
          db: "pubmed",
          term,
          reldate,
          retmode: "json",
          retmax: 10
        }
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from PubMed" });
    }
  });

  app.get("/api/pubmed/summary", async (req, res) => {
    try {
      const { id } = req.query;
      const response = await axios.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi", {
        params: {
          db: "pubmed",
          id,
          retmode: "json"
        }
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch PubMed summary" });
    }
  });

  // Proxy for ClinicalTrials.gov
  app.get("/api/clinicaltrials", async (req, res) => {
    try {
      const term = (req.query.term as string) || "all";
      const response = await axios.get("https://clinicaltrials.gov/api/v2/studies", {
        params: {
          query: term,
          pageSize: 10,
          sort: "lastUpdatePostDate:desc"
        }
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from ClinicalTrials.gov" });
    }
  });

  // Proxy for Europe PMC
  app.get("/api/europepmc", async (req, res) => {
    try {
      const rawQuery = req.query.query as string;
      const query = rawQuery && rawQuery.trim().length > 0
        ? rawQuery
        : (() => {
            const today = new Date();
            const fromDate = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            const formatDate = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
            return `FIRST_PDATE:[${formatDate(fromDate)} TO ${formatDate(today)}]`;
          })();

      const response = await axios.get("https://www.ebi.ac.uk/europepmc/webservices/rest/search", {
        params: {
          query,
          format: "json",
          pageSize: 10
        }
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from Europe PMC" });
    }
  });

  // Proxy for OpenAlex
  app.get("/api/openalex", async (req, res) => {
    try {
      const params: any = {
        per_page: 10,
        sort: "publication_year:desc"
      };
      if (req.query.search) {
        params.search = req.query.search;
      }

      const response = await axios.get("https://api.openalex.org/works", { params });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from OpenAlex" });
    }
  });

  // Proxy for bioRxiv / medRxiv
  app.get("/api/biorxiv", async (req, res) => {
    try {
      const { server } = req.query; // biorxiv or medrxiv
      const response = await axios.get(`https://api.biorxiv.org/pubs/${server}/2026-01-01/2026-12-31/0`);
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from bioRxiv/medRxiv" });
    }
  });

  // Proxy for openFDA
  app.get("/api/openfda", async (req, res) => {
    try {
      const params: any = {
        limit: 10
      };
      if (req.query.search) {
        params.search = req.query.search;
      }

      const response = await axios.get("https://api.fda.gov/drug/label.json", { params });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from openFDA" });
    }
  });

  // Proxy for ChEMBL
  app.get("/api/chembl", async (req, res) => {
    try {
      const params: any = {
        format: "json",
        limit: 10
      };
      if (req.query.query) {
        params.pref_name__icontains = req.query.query;
      }

      const response = await axios.get("https://www.ebi.ac.uk/chembl/api/data/molecule", { params });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from ChEMBL" });
    }
  });

  // Proxy for Orphanet (API corrigée)
  app.get("/api/orphanet", async (req, res) => {
    try {
      const queryString = (req.query.query as string) || "";
      // Utilisation de l'API Orphanet corrigée
      const response = await axios.get("https://api.orphadata.com/api/v1/rd-genes", {
        timeout: 10000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MEDWATCH/2.0 (medical@research.org)'
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Orphanet error:", error.message);
      res.status(500).json({ error: "Failed to fetch from Orphanet", details: error.message });
    }
  });

  // Semantic Scholar API
  app.get("/api/semantic-scholar", async (req, res) => {
    try {
      const query = (req.query.query as string) || "";
      const response = await axios.get("https://api.semanticscholar.org/graph/v1/paper/search", {
        params: {
          query,
          fields: "title,abstract,year,citationCount,authors",
          limit: 10
        },
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MEDWATCH/2.0 (medical@research.org)'
        },
        timeout: 30000
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Semantic Scholar error:", error.message);
      res.status(500).json({ error: "Failed to fetch from Semantic Scholar", details: error.message });
    }
  });

  // PubChem (fallback DrugBank)
  app.get("/api/pubchem/search", async (req, res) => {
    try {
      const name = (req.query.name as string) || "";
      // Recherche par nom
      const searchResponse = await axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/cids/JSON`, {
        timeout: 15000
      });
      res.json(searchResponse.data);
    } catch (error: any) {
      console.error("PubChem error:", error.message);
      res.status(500).json({ error: "Failed to fetch from PubChem", details: error.message });
    }
  });

  // PharmGKB API
  app.get("/api/pharmgkb", async (req, res) => {
    try {
      const name = (req.query.name as string) || "";
      const type = (req.query.type as string) || "chemical"; // chemical, gene
      
      const endpoint = type === "gene" 
        ? `https://api.pharmgkb.org/v1/data/gene/?symbol=${encodeURIComponent(name)}`
        : `https://api.pharmgkb.org/v1/data/chemical/?name=${encodeURIComponent(name)}`;
        
      const response = await axios.get(endpoint, {
        timeout: 15000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'MEDWATCH/2.0'
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("PharmGKB error:", error.message);
      res.status(500).json({ error: "Failed to fetch from PharmGKB", details: error.message });
    }
  });

  // Open Targets API (GraphQL)
  app.get("/api/open-targets", async (req, res) => {
    try {
      const ensemblId = (req.query.ensemblId as string) || "ENSG00000133703"; // Default: KRAS
      
      const query = {
        query: `query TargetDetails($ensemblId: String!) {
          target(ensemblId: $ensemblId) {
            id
            approvedSymbol
            approvedName
            biotype
          }
        }`,
        variables: { ensemblId }
      };
      
      const response = await axios.post("https://api.platform.opentargets.org/api/v4/graphql", query, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Open Targets error:", error.message);
      res.status(500).json({ error: "Failed to fetch from Open Targets", details: error.message });
    }
  });

  // RCSB PDB API
  app.post("/api/rcsb-pdb", async (req, res) => {
    try {
      const proteinName = req.query.name || "insulin";
      
      const query = {
        query: {
          type: "terminal",
          service: "text",
          parameters: {
            attribute: "struct.title",
            operator: "contains_words",
            value: proteinName
          }
        },
        return_type: "entry",
        request_options: {
          paginate: { start: 0, rows: 10 },
          sort: [{ sort_by: "score", direction: "desc" }]
        }
      };
      
      const response = await axios.post("https://search.rcsb.org/rcsbsearch/v2/query", query, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("RCSB PDB error:", error.message);
      res.status(500).json({ error: "Failed to fetch from RCSB PDB", details: error.message });
    }
  });

  // WHO IRIS API (DSpace 7)
  app.get("/api/who-iris", async (req, res) => {
    try {
      const query = (req.query.query as string) || "";
      const response = await axios.get("https://iris.who.int/server/api/discover/search/objects", {
        params: {
          query,
          page: 0,
          size: 10,
          sort: "score,DESC"
        },
        timeout: 15000
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("WHO IRIS error:", error.message);
      res.status(500).json({ error: "Failed to fetch from WHO IRIS", details: error.message });
    }
  });

  // EMA SPOR API
  app.get("/api/ema-spor", async (req, res) => {
    try {
      const type = (req.query.type as string) || "substances"; // substances, organisations
      const validTypes = ["substances", "organisations", "medicinal_products"];
      
      if (!validTypes.includes(type)) {
        return res.status(400).json({ error: "Invalid type. Use: substances, organisations, medicinal_products" });
      }
      
      const response = await axios.get(`https://spor.ema.europa.eu/rmswi/api/export/${type}`, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; MEDWATCH/2.0)'
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("EMA SPOR error:", error.message);
      res.status(500).json({ error: "Failed to fetch from EMA SPOR", details: error.message });
    }
  });

  // CrossRef API
  app.get("/api/crossref", async (req, res) => {
    try {
      const query = (req.query.query as string) || "";
      const response = await axios.get("https://api.crossref.org/works", {
        params: {
          query,
          rows: 10
        },
        headers: {
          'User-Agent': 'MEDWATCH/2.0 (mailto:medical@research.org)'
        },
        timeout: 15000
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("CrossRef error:", error.message);
      res.status(500).json({ error: "Failed to fetch from CrossRef", details: error.message });
    }
  });

  // Unpaywall API
  app.get("/api/unpaywall", async (req, res) => {
    try {
      const doi = (req.query.doi as string) || "";
      if (!doi) {
        return res.status(400).json({ error: "DOI parameter required" });
      }
      
      const response = await axios.get(`https://api.unpaywall.org/v2/${doi}`, {
        params: {
          email: "medical@research.org"
        },
        timeout: 10000
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Unpaywall error:", error.message);
      res.status(500).json({ error: "Failed to fetch from Unpaywall", details: error.message });
    }
  });

  // Proxy for RSS
  app.get("/api/rss", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: "URL is required" });

      // Add headers to handle CORS and user agent
      const response = await axios.get(url as string, {
        headers: {
          'User-Agent': 'MedWatch-AI/1.0 (https://medwatch.ai)',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        timeout: 10000,
        responseType: 'stream'
      });

      const feedparser = new FeedParser({});
      const items: any[] = [];
      let responded = false;

      response.data.pipe(feedparser);

      feedparser.on("readable", function() {
        let item;
        while (item = feedparser.read()) {
          items.push({
            title: item.title,
            description: item.description,
            link: item.link,
            pubDate: item.pubDate,
            guid: item.guid
          });
        }
      });

      feedparser.on("end", () => {
        if (!responded) {
          responded = true;
          res.json(items);
        }
      });

      feedparser.on("error", (err: any) => {
        console.error("Feed parsing error:", err);
        if (!responded) {
          responded = true;
          res.status(500).json({ error: "Failed to parse RSS feed", details: err.message });
        }
      });

      // Handle stream errors
      response.data.on('error', (err: any) => {
        console.error("Stream error:", err);
        if (!responded) {
          responded = true;
          res.status(500).json({ error: "Failed to fetch RSS feed", details: err.message });
        }
      });

    } catch (error: any) {
      console.error("RSS fetch error:", error.message);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to fetch RSS feed", details: error.message });
      }
    }
  });

  app.post("/api/scrape", async (req, res) => {
    try {
      const {
        url,
        listSelector,
        titleSelector,
        linkSelector,
        descriptionSelector,
        dateSelector,
        baseUrl
      } = req.body;

      if (!url || !listSelector || !titleSelector || !linkSelector) {
        return res.status(400).json({ error: "Missing required scraping parameters" });
      }

      const response = await axios.get(url as string, {
        headers: {
          'User-Agent': 'MedWatch-AI/1.0 (https://medwatch.ai)',
          'Accept': 'text/html,application/xhtml+xml,application/xml'
        },
        timeout: 15000
      });

      const html = response.data;
      const $ = cheerio.load(html);
      const items: any[] = [];

      $(listSelector).each((_, el) => {
        const title = $(el).find(titleSelector).text().trim();
        let link = $(el).find(linkSelector).attr("href") || "";
        const description = descriptionSelector ? $(el).find(descriptionSelector).text().trim() : $(el).text().trim();
        const publishedDate = dateSelector ? $(el).find(dateSelector).attr("datetime") || $(el).find(dateSelector).text().trim() : "";

        if (link && link.startsWith("/") && baseUrl) {
          link = baseUrl.replace(/\/$/, "") + link;
        }

        if (title && link) {
          items.push({ title, description, link, pubDate: publishedDate || "" });
        }
      });

      res.json(items.slice(0, 15));
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({ error: "Failed to scrape page", details: error.message });
    }
  });

  // GET endpoint for scraping with predefined sources
  app.get("/api/scrape/source", async (req, res) => {
    try {
      const { source } = req.query;
      if (!source) return res.status(400).json({ error: "Source parameter required (fda, who, ema, nejm)" });

      const scrapeConfigs: Record<string, any> = {
        fda: {
          url: "https://www.fda.gov/news-events/press-announcements",
          listSelector: ".view-content .views-row, article.news-item, .search-result",
          titleSelector: "h2 a, h3 a, .title a",
          linkSelector: "a",
          descriptionSelector: ".summary, .description, p",
          baseUrl: "https://www.fda.gov"
        },
        who: {
          url: "https://www.who.int/news",
          listSelector: "article.sf-news-item, .news-item, article",
          titleSelector: "h2 a, h3 a, .title a",
          linkSelector: "a",
          descriptionSelector: ".summary, p",
          baseUrl: "https://www.who.int"
        },
        ema: {
          url: "https://www.ema.europa.eu/en/news",
          listSelector: ".news-item, article, .views-row",
          titleSelector: "h2 a, h3 a",
          linkSelector: "a",
          descriptionSelector: ".summary, p",
          baseUrl: "https://www.ema.europa.eu"
        },
        nejm: {
          url: "https://www.nejm.org/medical-articles/recent",
          listSelector: ".article-item, article, .result",
          titleSelector: "h2 a, h3 a, .title a",
          linkSelector: "a",
          descriptionSelector: ".abstract, .summary, p",
          baseUrl: "https://www.nejm.org"
        }
      };

      const config = scrapeConfigs[source as string];
      if (!config) {
        return res.status(400).json({ error: "Unknown source. Available: fda, who, ema, nejm" });
      }

      const response = await axios.get(config.url, {
        headers: {
          'User-Agent': 'MedWatch-AI/1.0 (https://medwatch.ai)',
          'Accept': 'text/html,application/xhtml+xml'
        },
        timeout: 15000
      });

      const $ = cheerio.load(response.data);
      const items: any[] = [];

      $(config.listSelector).each((_, el) => {
        const title = $(el).find(config.titleSelector).text().trim();
        let link = $(el).find(config.linkSelector).attr("href") || "";
        const description = config.descriptionSelector ? $(el).find(config.descriptionSelector).text().trim() : "";

        if (link && link.startsWith("/") && config.baseUrl) {
          link = config.baseUrl.replace(/\/$/, "") + link;
        }

        if (title && link) {
          items.push({ title, description: description.substring(0, 200), link, source: source });
        }
      });

      res.json({ results: items.slice(0, 15), count: items.length, source });
    } catch (error: any) {
      console.error("Scraping error:", error.message);
      res.status(500).json({ error: "Failed to scrape", details: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Background collection every 6 hours
    console.log("⏰ Background collection scheduler started");
    
    // Initial collection on startup (after 30 seconds)
    setTimeout(async () => {
      console.log("🔄 Running initial collection on startup...");
      await runBackgroundCollection();
    }, 30000);
    
    // Recurring collection every 6 hours
    setInterval(async () => {
      try {
        await runBackgroundCollection();
      } catch (error) {
        console.error("Background collection error:", error);
      }
    }, 6 * 60 * 60 * 1000);
  });
}

startServer();
