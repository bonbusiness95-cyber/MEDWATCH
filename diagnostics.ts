import axios from "axios";
import FeedParser from "feedparser";
import * as cheerio from "cheerio";
import { rssSources, scrapeSources } from "./src/services/sourceConfig.ts";

// Test RSS sources
async function testRSSSources() {
  console.log("\n🧪 Testing RSS Sources...\n");

  for (const source of rssSources) {
    try {
      console.log(`Testing ${source.label}...`);
      const response = await axios.get(source.url, {
        headers: {
          'User-Agent': 'MedWatch-AI/1.0',
          'Accept': 'application/rss+xml, application/xml, text/xml'
        },
        timeout: 10000,
        responseType: 'stream'
      });

      const feedparser = new FeedParser({});
      let itemCount = 0;

      await new Promise((resolve, reject) => {
        response.data.pipe(feedparser);

        feedparser.on("readable", function() {
          let item;
          while (item = feedparser.read()) {
            itemCount++;
            if (itemCount >= 3) break; // Just check first few items
          }
        });

        feedparser.on("end", resolve);
        feedparser.on("error", reject);
      });

      console.log(`✅ ${source.label}: OK (${itemCount} items found)`);
    } catch (error: any) {
      console.log(`❌ ${source.label}: ${error.code || error.message}`);
    }
  }
}

// Test scraping sources
async function testScrapeSources() {
  console.log("\n🧪 Testing Scraping Sources...\n");

  for (const source of scrapeSources) {
    try {
      console.log(`Testing ${source.label}...`);
      const response = await axios.get(source.url, {
        headers: {
          'User-Agent': 'MedWatch-AI/1.0'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      const items = $(source.listSelector);
      console.log(`✅ ${source.label}: OK (${items.length} items found)`);
    } catch (error: any) {
      console.log(`❌ ${source.label}: ${error.code || error.message}`);
    }
  }
}

// Test API sources
async function testAPISources() {
  console.log("\n🧪 Testing API Sources...\n");

  const apiTests = [
    { name: "PubMed", url: "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=cancer&retmode=json" },
    { name: "ClinicalTrials", url: "https://clinicaltrials.gov/api/v2/studies?query.term=medication&pageSize=1" },
    { name: "Europe PMC", url: "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=cancer&format=json" },
    { name: "OpenFDA", url: "https://api.fda.gov/drug/event.json?limit=1" },
    { name: "CrossRef", url: "https://api.crossref.org/works?query=cancer&rows=1" },
    { name: "Semantic Scholar", url: "https://api.semanticscholar.org/graph/v1/paper/search?query=cancer&limit=1" },
    { name: "ChEMBL", url: "https://www.ebi.ac.uk/chembl/api/data/molecule?pref_name__icontains=treatment&format=json&limit=1" },
    { name: "DrugBank (PubChem fallback)", url: "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/treatment/cids/JSON" },
    { name: "RxNorm", url: "https://rxnav.nlm.nih.gov/REST/drugs.json?name=treatment" },
    { name: "UniProt", url: "https://rest.uniprot.org/uniprotkb/search?query=treatment&format=json&size=1" },
    { name: "OMIM", url: "https://www.omim.org/search?index=entry&start=1&limit=1&search=treatment" },
    { name: "ClinVar", url: "https://www.ncbi.nlm.nih.gov/clinvar/?term=treatment" },
    { name: "PharmGKB", url: "https://api.pharmgkb.org/v1/data/chemical?name=aspirin" },
    { name: "DisGeNET", url: "https://www.disgenet.org/api/v1/disease/search?query=treatment&format=json" },
    {
      name: "Open Targets",
      url: "https://api.platform.opentargets.org/api/v4/graphql",
      method: "POST",
      body: {
        query: "query TargetDetails($ensemblId: String!) { target(ensemblId: $ensemblId) { id approvedSymbol approvedName biotype associatedDiseases(page: {index: 0, size: 1}) { rows { disease { id name } score } } } }",
        variables: { ensemblId: "ENSG00000133703" }
      }
    },
    {
      name: "RCSB PDB",
      url: "https://search.rcsb.org/rcsbsearch/v2/query",
      method: "POST",
      body: {
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
            rows: 1
          },
          sort: [
            {
              sort_by: "score",
              direction: "desc"
            }
          ]
        }
      }
    },
    { name: "GEO NCBI", url: "https://www.ncbi.nlm.nih.gov/geo/browse/?view=series&search=treatment&zsort=date&display=20" },
    { name: "EMA SPOR", url: "https://www.ema.europa.eu/en/search?q=treatment&type=medicinal_product" },
    { name: "WHO IRIS", url: "https://iris.who.int/server/api/discover/search/objects?query=treatment&page=0&size=1" },
    { name: "Orphanet", url: "https://www.orphadata.com/data/xml/en_product6.xml" }
  ];

  for (const api of apiTests) {
    try {
      console.log(`Testing ${api.name}...`);
      const response = api.method === "POST"
        ? await axios.post(api.url, api.body, { timeout: 20000, headers: { "Content-Type": "application/json", Accept: "application/json" } })
        : await axios.get(api.url, { timeout: 20000 });
      console.log(`✅ ${api.name}: OK (Status: ${response.status})`);
    } catch (error: any) {
      console.log(`❌ ${api.name}: ${error.code || error.message}`);
      if (error.response) {
        console.log(`   status: ${error.response.status}`);
      }
    }
  }
}

// Run all tests
async function runDiagnostics() {
  console.log("🔍 MEDWATCH Source Diagnostics\n");
  console.log("=====================================\n");

  await testAPISources();
  await testRSSSources();
  await testScrapeSources();

  console.log("\n✅ Diagnostics complete!");
}

runDiagnostics().catch(console.error);