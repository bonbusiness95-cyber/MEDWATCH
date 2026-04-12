/**
 * Test des nouvelles sources médicales corrigées
 * Version 2.0 - Sources: API, RSS, Scraping
 */

const http = require('http');

const baseUrl = 'http://localhost:3000';
const results = [];

function makeRequest(path, method = 'GET', postData = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      timeout: 30000,
      headers: {}
    };

    if (postData) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data.substring(0, 200) });
        }
      });
    });

    req.on('error', (e) => reject(e.message));
    req.on('timeout', () => { req.destroy(); reject('Timeout'); });
    
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function testSource(name, path, category, method = 'GET', postData = null) {
  console.log(`Testing ${name}...`);
  try {
    const result = await makeRequest(path, method, postData);
    const status = result.status === 200 ? '✅ OK' : `⚠️ ${result.status}`;
    let info = '';
    
    if (result.data && result.data.items) info = `(${result.data.items.length} items)`;
    else if (result.data && result.data.results) info = `(${result.data.results.length} results)`;
    else if (result.data && result.data.articles) info = `(${result.data.articles.length} articles)`;
    else if (result.data && result.data.data) info = `(${Array.isArray(result.data.data) ? result.data.data.length : 'data'} items)`;
    else if (result.data && result.data.result) info = `(result: ${JSON.stringify(result.data.result).substring(0, 50)})`;
    else if (result.data && result.data.total) info = `(${result.data.total} total)`;
    
    results.push({ name, category, status: status + ' ' + info, path });
    console.log(`  ✅ ${info || 'OK'}`);
  } catch (e) {
    results.push({ name, category, status: '❌ ' + e, path });
    console.log(`  ❌ ${e}`);
  }
}

async function runTests() {
  console.log('🧪 Testing MEDWATCH v2.0 - New Medical Sources\n');

  // ===== SOURCES API CORRIGÉES =====
  console.log('\n📊 Testing NEW API Sources (v2.0)...');
  
  await testSource('Semantic Scholar', '/api/semantic-scholar?query=cancer', 'API v2.0');
  await testSource('PubChem (fallback DrugBank)', '/api/pubchem/search?name=aspirin', 'API v2.0');
  await testSource('PharmGKB - Chemical', '/api/pharmgkb?name=warfarin&type=chemical', 'API v2.0');
  await testSource('PharmGKB - Gene', '/api/pharmgkb?name=CYP2C9&type=gene', 'API v2.0');
  await testSource('Open Targets', '/api/open-targets?ensemblId=ENSG00000133703', 'API v2.0');
  await testSource('RCSB PDB', '/api/rcsb-pdb?name=insulin', 'API v2.0', 'POST');
  await testSource('WHO IRIS', '/api/who-iris?query=malaria', 'API v2.0');
  await testSource('EMA SPOR - Substances', '/api/ema-spor?type=substances', 'API v2.0');
  await testSource('Orphanet', '/api/orphanet', 'API v2.0');
  await testSource('CrossRef', '/api/crossref?query=diabetes', 'API v2.0');
  await testSource('Unpaywall', '/api/unpaywall?doi=10.1038/nature12373', 'API v2.0');

  // ===== SOURCES EXISTANTES =====
  console.log('\n📊 Testing Existing API Sources...');
  await testSource('PubMed', '/api/pubmed/search?term=diabetes', 'API Base');
  await testSource('ClinicalTrials', '/api/clinicaltrials?condition=cancer', 'API Base');
  await testSource('Europe PMC', '/api/europe-pmc?query=heart', 'API Base');
  await testSource('OpenFDA', '/api/openfda?search=aspirin', 'API Base');
  await testSource('ChEMBL', '/api/chembl?query=ibuprofen', 'API Base');
  await testSource('Orphanet Legacy', '/api/orphanet?query=all', 'API Base');

  // ===== RSS SOURCES =====
  console.log('\n📡 Testing RSS Sources (fonctionnels)...');
  await testSource('Nature Medicine RSS', '/api/rss?url=https://www.nature.com/nm.rss', 'RSS');
  await testSource('Eurosurveillance RSS', '/api/rss?url=https://www.eurosurveillance.org/rss', 'RSS');
  await testSource('CDC EID RSS', '/api/rss?url=https://wwwnc.cdc.gov/eid/rss/etoc-rss', 'RSS');

  // ===== RÉSUMÉ =====
  console.log('\n' + '='.repeat(70));
  console.log('📋 RESULTS SUMMARY - MEDWATCH v2.0');
  console.log('='.repeat(70));
  
  const categories = [...new Set(results.map(r => r.category))];
  categories.forEach(cat => {
    console.log(`\n[${cat}]`);
    results.filter(r => r.category === cat).forEach(r => {
      const icon = r.status.includes('✅') ? '✅' : (r.status.includes('⚠️') ? '⚠️' : '❌');
      console.log(`  ${icon} ${r.name}: ${r.status}`);
    });
  });
  
  const ok = results.filter(r => r.status.includes('✅')).length;
  const warning = results.filter(r => r.status.includes('⚠️')).length;
  const total = results.length;
  const percent = Math.round((ok / total) * 100);
  
  console.log('\n' + '='.repeat(70));
  console.log(`📊 STATISTICS:`);
  console.log(`  ✅ Functional: ${ok}/${total} (${percent}%)`);
  console.log(`  ⚠️  Warning: ${warning}/${total}`);
  console.log(`  ❌ Failed: ${total - ok - warning}/${total}`);
  console.log('='.repeat(70));
  
  // Export JSON
  const fs = require('fs');
  fs.writeFileSync('test-new-sources-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Results saved to: test-new-sources-results.json');
}

runTests().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
