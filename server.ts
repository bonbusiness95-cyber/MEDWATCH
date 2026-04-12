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

  // Proxy for Orphanet (using a public search endpoint if available or similar)
  // Note: Orphanet API often requires registration, but we can use their public RD-Connect or similar if available.
  // For now, let's use a generic search proxy that could be adapted.
  app.get("/api/orphanet", async (req, res) => {
    try {
      const queryString = (req.query.query as string) || "all";
      // Using a placeholder for Orphanet as their API is strictly controlled.
      // We can simulate it or use a related open source like Rare Disease Hub if needed.
      const response = await axios.get(`https://www.orpha.net/api/search?q=${encodeURIComponent(queryString)}`);
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from Orphanet" });
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
        timeout: 10000, // 10 second timeout
        responseType: 'stream' // Keep stream for feedparser
      });
      const feedparser = new FeedParser({});
      const items: any[] = [];

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
        res.json(items);
      });

      feedparser.on("error", (err: any) => {
        console.error("Feed parsing error:", err);
        res.status(500).json({ error: "Failed to parse RSS feed" });
      });
    } catch (error: any) {
      console.error("RSS fetch error:", error.message);
      res.status(500).json({ error: "Failed to fetch RSS feed", details: error.message });
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
