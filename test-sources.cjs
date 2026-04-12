const http = require('http');
const https = require('https');

const baseUrl = 'http://localhost:3000';
const results = [];

function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = baseUrl + path;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      timeout: 15000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data.substring(0, 200) });
        }
      });
    });

    req.on('error', (e) => reject(e.message));
    req.on('timeout', () => { req.destroy(); reject('Timeout'); });
    req.end();
  });
}

async function testSource(name, path, category) {
  console.log(`Testing ${name}...`);
  try {
    const result = await makeRequest(path);
    const status = result.status === 200 ? '✅ OK' : `⚠️ ${result.status}`;
    let info = '';
    if (result.data && result.data.items) info = `(${result.data.items.length} items)`;
    else if (result.data && result.data.results) info = `(${result.data.results.length} results)`;
    else if (result.data && result.data.articles) info = `(${result.data.articles.length} articles)`;
    else if (result.data && result.data.success !== undefined) info = `(success: ${result.data.success})`;
    
    results.push({ name, category, status: status + ' ' + info, path });
    console.log(`  ✅ ${info}`);
  } catch (e) {
    results.push({ name, category, status: '❌ ' + e, path });
    console.log(`  ❌ ${e}`);
  }
}

async function runTests() {
  console.log('🧪 Testing MEDWATCH sources...\n');

  // Test Health
  await testSource('Health Check', '/api/health', 'System');
  
  // Test APIs
  console.log('\n📊 Testing APIs...');
  await testSource('PubMed', '/api/pubmed/search?term=diabetes', 'API');
  await testSource('ClinicalTrials', '/api/clinical-trials?condition=cancer', 'API');
  await testSource('Europe PMC', '/api/europe-pmc?query=heart', 'API');
  await testSource('OpenFDA', '/api/openfda/drugs', 'API');
  
  // Test RSS with valid feeds
  console.log('\n📡 Testing RSS feeds...');
  await testSource('NEJM RSS', '/api/rss?url=https://www.nejm.org/rss/recent', 'RSS');
  await testSource('Nature Medicine RSS', '/api/rss?url=https://www.nature.com/nm.rss', 'RSS');
  await testSource('BMJ RSS', '/api/rss?url=https://www.bmj.com/rss/recent.xml', 'RSS');
  
  // Test Scraping with new endpoint
  console.log('\n🕷️ Testing Scraping...');
  await testSource('FDA Scrape', '/api/scrape/source?source=fda', 'Scrape');
  await testSource('WHO Scrape', '/api/scrape/source?source=who', 'Scrape');
  
  // Summary
  console.log('\n📋 RESULTS SUMMARY');
  console.log('='.repeat(60));
  
  const categories = [...new Set(results.map(r => r.category))];
  categories.forEach(cat => {
    console.log(`\n[${cat}]`);
    results.filter(r => r.category === cat).forEach(r => {
      const icon = r.status.includes('✅') ? '✅' : '❌';
      console.log(`  ${icon} ${r.name}: ${r.status}`);
    });
  });
  
  const ok = results.filter(r => r.status.includes('✅')).length;
  console.log(`\n📊 Total: ${ok}/${results.length} working (${Math.round((ok/results.length)*100)}%)`);
}

runTests().catch(console.error);
