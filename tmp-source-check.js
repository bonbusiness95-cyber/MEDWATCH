const https = require('https');
const http = require('http');
const urls = [
  {name:'PubMed search', url:'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=all%5Bsb%5D&reldate=7&retmode=json&retmax=15', check:'idlist'},
  {name:'ClinicalTrials', url:'https://clinicaltrials.gov/api/v2/studies?query.term=all&pageSize=10&sort=LastUpdatePostDate:desc', check:'studies'},
  {name:'EuropePMC', url:'https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=drug%20therapy%20treatment&format=json&pageSize=10', check:'resultList'},
  {name:'OpenFDA', url:'https://api.fda.gov/drug/label.json?limit=10', check:'results'},
  {name:'CrossRef', url:'https://api.crossref.org/works?rows=15&sort=published', check:'message'},
  {name:'SemanticScholar', url:'https://api.semanticscholar.org/graph/v1/paper/search?limit=5&fields=title,abstract,url,year,citationCount,authors', check:'data'},
  {name:'ChEMBL', url:'https://www.ebi.ac.uk/chembl/api/data/molecule?format=json&limit=10', check:'molecules'},
  {name:'NEJM RSS', url:'https://www.nejm.org/rss/recent', check:'<rss'}
];
const get = (url) => new Promise((resolve, reject) => {
  const lib = url.startsWith('https') ? https : http;
  lib.get(url, { headers: { 'User-Agent': 'MedWatch-Test/1.0', 'Accept': 'application/json,text/xml' } }, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => resolve({ status: res.statusCode, body: data.replace(/\n/g, ' ') }));
  }).on('error', reject);
});
(async () => {
  for (const item of urls) {
    try {
      const r = await get(item.url);
      const ok = r.body.includes(item.check);
      console.log(`${item.name}: status=${r.status} ok=${ok} contains=${item.check}`);
      console.log(`  length=${r.body.length} snippet=${r.body.slice(0,140).replace(/"/g,'')}`);
    } catch (e) {
      console.error(`${item.name}: ERROR ${e.message}`);
    }
  }
})();
