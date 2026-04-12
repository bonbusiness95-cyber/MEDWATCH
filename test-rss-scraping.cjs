/**
 * Test spécifique des sources RSS et Web Scraping
 * Basé sur RSS_SCRAPING_STATUS.md
 */

const http = require('http');

const baseUrl = 'http://localhost:3000';
const results = {
  rss: [],
  scraping: [],
  alternatives: []
};

function makeRequest(path, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      timeout: timeout
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: json, raw: data.substring(0, 300) });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, raw: data.substring(0, 300) });
        }
      });
    });

    req.on('error', (e) => reject(e.message));
    req.on('timeout', () => { req.destroy(); reject('Timeout'); });
    req.end();
  });
}

async function testRSS(name, url, expected = 'functional') {
  const path = `/api/rss?url=${encodeURIComponent(url)}`;
  console.log(`📡 Testing RSS: ${name}...`);
  
  try {
    const result = await makeRequest(path, 20000);
    const items = result.data && Array.isArray(result.data) ? result.data.length : 
                  (result.data && result.data.items ? result.data.items.length : 0);
    
    let status, icon;
    if (result.status === 200 && items > 0) {
      status = `✅ OK (${items} items)`;
      icon = '✅';
    } else if (result.status === 200) {
      status = `⚠️ OK mais 0 items`;
      icon = '⚠️';
    } else {
      status = `❌ Erreur ${result.status}`;
      icon = '❌';
    }
    
    results.rss.push({ name, url, status, items, category: expected });
    console.log(`   ${icon} ${status}`);
  } catch (e) {
    results.rss.push({ name, url, status: `❌ ${e}`, items: 0, category: expected });
    console.log(`   ❌ ${e}`);
  }
}

async function testScraping(name, source) {
  const path = `/api/scrape/source?source=${source}`;
  console.log(`🕷️ Testing Scraping: ${name}...`);
  
  try {
    const result = await makeRequest(path, 20000);
    const items = result.data && result.data.results ? result.data.results.length : 
                  (result.data && result.data.count ? result.data.count : 0);
    
    let status, icon;
    if (result.status === 200 && items > 0) {
      status = `✅ OK (${items} items)`;
      icon = '✅';
    } else if (result.status === 200) {
      status = `⚠️ OK mais 0 items (selecteurs obsolètes)`;
      icon = '⚠️';
    } else {
      status = `❌ Erreur ${result.status}`;
      icon = '❌';
    }
    
    results.scraping.push({ name, source, status, items });
    console.log(`   ${icon} ${status}`);
  } catch (e) {
    results.scraping.push({ name, source, status: `❌ ${e}`, items: 0 });
    console.log(`   ❌ ${e}`);
  }
}

async function testAlternative(name, path, type = 'API') {
  console.log(`🔌 Testing Alternative ${type}: ${name}...`);
  
  try {
    const result = await makeRequest(path, 15000);
    const hasData = result.data && (result.data.items || result.data.results || result.data.data || result.data.total || Object.keys(result.data).length > 0);
    
    let status, icon;
    if (result.status === 200 && hasData) {
      status = `✅ OK (données disponibles)`;
      icon = '✅';
    } else if (result.status === 200) {
      status = `⚠️ OK (pas de données)`;
      icon = '⚠️';
    } else {
      status = `❌ Erreur ${result.status}`;
      icon = '❌';
    }
    
    results.alternatives.push({ name, type, path, status });
    console.log(`   ${icon} ${status}`);
  } catch (e) {
    results.alternatives.push({ name, type, path, status: `❌ ${e}` });
    console.log(`   ❌ ${e}`);
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST DES SOURCES RSS ET WEB SCRAPING - MEDWATCH v2.0');
  console.log('='.repeat(70));
  
  // ===== 1. RSS FONCTIONNELS =====
  console.log('\n📡 RSS - Sources Fiables (recommandées)');
  console.log('-'.repeat(70));
  await testRSS('Nature Medicine', 'https://www.nature.com/nm.rss', 'functional');
  await testRSS('BMJ', 'https://www.bmj.com/rss/recent.xml', 'functional');
  await testRSS('PLOS Medicine', 'https://journals.plos.org/plosmedicine/feed/atom', 'functional');
  await testRSS('CDC MMWR', 'https://www.cdc.gov/mmwr/rss/mmwr.xml', 'functional');
  await testRSS('Eurosurveillance', 'https://www.eurosurveillance.org/rss.xml', 'functional');
  
  // ===== 2. RSS BLOQUÉS (pour démonstration) =====
  console.log('\n📡 RSS - Sources Bloquées (à éviter)');
  console.log('-'.repeat(70));
  await testRSS('NEJM (bloqué)', 'https://www.nejm.org/rss/recent', 'blocked');
  await testRSS('FDA (instable)', 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml', 'blocked');
  await testRSS('WHO (bloqué)', 'https://www.who.int/rss-feeds/news-english.xml', 'blocked');
  
  // ===== 3. WEB SCRAPING =====
  console.log('\n🕷️ Web Scraping - État actuel');
  console.log('-'.repeat(70));
  await testScraping('FDA Press Releases', 'fda');
  await testScraping('WHO News', 'who');
  await testScraping('EMA News', 'ema');
  await testScraping('NEJM Articles', 'nejm');
  
  // ===== 4. ALTERNATIVES APIs =====
  console.log('\n🔌 Alternatives APIs (recommandées)');
  console.log('-'.repeat(70));
  await testAlternative('PubMed (NEJM via API)', '/api/pubmed/search?term=N+Engl+J+Med[Journal]', 'API');
  await testAlternative('WHO IRIS API', '/api/who-iris?query=malaria', 'API');
  await testAlternative('OpenFDA', '/api/openfda?search=recall', 'API');
  await testAlternative('Europe PMC', '/api/europe-pmc?query=heart', 'API');
  await testAlternative('EMA SPOR', '/api/ema-spor?type=substances', 'API');
  
  // ===== RÉSUMÉ =====
  console.log('\n' + '='.repeat(70));
  console.log('📋 RÉSUMÉ EXÉCUTIF');
  console.log('='.repeat(70));
  
  const rssOK = results.rss.filter(r => r.status.includes('✅')).length;
  const rssTotal = results.rss.length;
  
  const scrapeOK = results.scraping.filter(r => r.status.includes('✅')).length;
  const scrapeWarn = results.scraping.filter(r => r.status.includes('⚠️')).length;
  const scrapeTotal = results.scraping.length;
  
  const apiOK = results.alternatives.filter(r => r.status.includes('✅')).length;
  const apiTotal = results.alternatives.length;
  
  console.log(`\n📡 RSS Sources:`);
  console.log(`   ✅ Fonctionnels: ${rssOK}/${rssTotal} (${Math.round((rssOK/rssTotal)*100)}%)`);
  console.log(`   ❌ Bloqués: ${rssTotal - rssOK}/${rssTotal}`);
  
  console.log(`\n🕷️ Web Scraping:`);
  console.log(`   ✅ Fonctionnels: ${scrapeOK}/${scrapeTotal} (${Math.round((scrapeOK/scrapeTotal)*100)}%)`);
  console.log(`   ⚠️  Partiels: ${scrapeWarn}/${scrapeTotal}`);
  console.log(`   ❌ Bloqués: ${scrapeTotal - scrapeOK - scrapeWarn}/${scrapeTotal}`);
  
  console.log(`\n🔌 APIs Alternatives:`);
  console.log(`   ✅ Fonctionnels: ${apiOK}/${apiTotal} (${Math.round((apiOK/apiTotal)*100)}%)`);
  
  console.log(`\n📊 GLOBAL:`);
  const totalOK = rssOK + scrapeOK + apiOK;
  const total = rssTotal + scrapeTotal + apiTotal;
  console.log(`   ✅ Sources utilisables: ${totalOK}/${total} (${Math.round((totalOK/total)*100)}%)`);
  
  console.log('\n' + '='.repeat(70));
  console.log('💡 RECOMMANDATION STRATÉGIQUE');
  console.log('='.repeat(70));
  console.log('1. ✅ Utiliser les 5 flux RSS fonctionnels');
  console.log('2. ✅ Utiliser les APIs alternatives (PubMed, WHO IRIS, OpenFDA)');
  console.log('3. ⚠️  Éviter le scraping des sites protégés (FDA, WHO, NEJM)');
  console.log('4. ⚠️  Ne pas compter sur les RSS bloqués (NEJM, Lancet direct)');
  console.log('='.repeat(70));
  
  // Sauvegarde
  const fs = require('fs');
  fs.writeFileSync('test-rss-scraping-results.json', JSON.stringify(results, null, 2));
  console.log('\n💾 Résultats sauvegardés dans: test-rss-scraping-results.json');
}

runTests().catch(err => {
  console.error('Erreur:', err);
  process.exit(1);
});
