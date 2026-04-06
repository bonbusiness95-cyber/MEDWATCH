import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import FeedParser from "feedparser";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
      const { term } = req.query;
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
      const { query } = req.query;
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
      const { search } = req.query;
      const response = await axios.get("https://api.openalex.org/works", {
        params: {
          search,
          per_page: 10,
          sort: "publication_year:desc"
        }
      });
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
      const { search } = req.query;
      const response = await axios.get("https://api.fda.gov/drug/label.json", {
        params: {
          search,
          limit: 10
        }
      });
      res.json(response.data);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch from openFDA" });
    }
  });

  // Proxy for ChEMBL
  app.get("/api/chembl", async (req, res) => {
    try {
      const { query } = req.query;
      const response = await axios.get("https://www.ebi.ac.uk/chembl/api/data/molecule", {
        params: {
          pref_name__icontains: query,
          format: "json",
          limit: 10
        }
      });
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
      const { query } = req.query;
      // Using a placeholder for Orphanet as their API is strictly controlled.
      // We can simulate it or use a related open source like Rare Disease Hub if needed.
      // For this demo, let's assume we have an endpoint.
      const response = await axios.get(`https://www.orpha.net/api/search?q=${query}`);
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
      
      const response = await axios.get(url as string, { responseType: "stream" });
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
        res.status(500).json({ error: "Failed to parse RSS" });
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch RSS" });
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
    
    // Background Scraping Task (Every hour)
    setInterval(async () => {
      console.log("Running background medical watch...");
      // In a real app, we would call the scraping logic here
      // and save to Firestore using a service account or admin SDK.
      // For this environment, we'll keep it simple.
    }, 3600000);
  });
}

startServer();
