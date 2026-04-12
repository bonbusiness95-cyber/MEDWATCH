# Test des sources MEDWATCH
# Liste des URLs à tester avec leur catégorie

$baseUrl = "http://localhost:3000"
$results = @()

Write-Host "🧪 Test des sources MEDWATCH" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

# 1. APIs médicales de base
Write-Host "`n📊 Test APIs médicales..." -ForegroundColor Yellow

$apiTests = @(
    @{ Name = "PubMed"; Endpoint = "/api/pubmed/search?term=diabetes"; Category = "API" },
    @{ Name = "ClinicalTrials.gov"; Endpoint = "/api/clinical-trials?condition=cancer"; Category = "API" },
    @{ Name = "Europe PMC"; Endpoint = "/api/europe-pmc?query=heart+disease"; Category = "API" },
    @{ Name = "OpenFDA"; Endpoint = "/api/openfda/drugs"; Category = "API" },
    @{ Name = "Health Check"; Endpoint = "/api/health"; Category = "API" }
)

foreach ($test in $apiTests) {
    try {
        $url = "$baseUrl$($test.Endpoint)"
        Write-Host "  Test $($test.Name)... " -NoNewline
        $response = Invoke-RestMethod -Uri $url -TimeoutSec 10 -ErrorAction Stop
        $results += @{ Source = $test.Name; Status = "✅ OK"; Category = $test.Category; Response = ($response | ConvertTo-Json -Depth 1 -Compress).Substring(0, [Math]::Min(100, ($response | ConvertTo-Json -Depth 1 -Compress).Length)) }
        Write-Host "✅" -ForegroundColor Green
    } catch {
        $results += @{ Source = $test.Name; Status = "❌ ERREUR"; Category = $test.Category; Response = $_.Exception.Message }
        Write-Host "❌" -ForegroundColor Red
    }
}

# 2. Test RSS (sampling des plus importants)
Write-Host "`n📡 Test flux RSS (échantillon)..." -ForegroundColor Yellow

$rssTests = @(
    @{ Name = "NEJM RSS"; Endpoint = "/api/rss?url=https://www.nejm.org/rss/recent"; Category = "RSS" },
    @{ Name = "FDA RSS"; Endpoint = "/api/rss?url=https://www.fda.gov/news-events/press-announcements"; Category = "RSS" },
    @{ Name = "WHO RSS"; Endpoint = "/api/rss?url=https://www.who.int/news"; Category = "RSS" }
)

foreach ($test in $rssTests) {
    try {
        $url = "$baseUrl$($test.Endpoint)"
        Write-Host "  Test $($test.Name)... " -NoNewline
        $response = Invoke-RestMethod -Uri $url -TimeoutSec 15 -ErrorAction Stop
        $count = if ($response.items) { $response.items.Count } else { 0 }
        $results += @{ Source = $test.Name; Status = "✅ OK ($count items)"; Category = $test.Category; Response = "Found $count items" }
        Write-Host "✅ ($count items)" -ForegroundColor Green
    } catch {
        $results += @{ Source = $test.Name; Status = "❌ ERREUR"; Category = $test.Category; Response = $_.Exception.Message }
        Write-Host "❌" -ForegroundColor Red
    }
}

# 3. Test Scraping (sampling)
Write-Host "`n🕷️ Test Web Scraping (échantillon)..." -ForegroundColor Yellow

$scrapeTests = @(
    @{ Name = "FDA Scrape"; Endpoint = "/api/scrape?source=fda"; Category = "Scrape" },
    @{ Name = "WHO Scrape"; Endpoint = "/api/scrape?source=who"; Category = "Scrape" }
)

foreach ($test in $scrapeTests) {
    try {
        $url = "$baseUrl$($test.Endpoint)"
        Write-Host "  Test $($test.Name)... " -NoNewline
        $response = Invoke-RestMethod -Uri $url -TimeoutSec 15 -ErrorAction Stop
        $count = if ($response.results) { $response.results.Count } else { 0 }
        $results += @{ Source = $test.Name; Status = "✅ OK ($count items)"; Category = $test.Category; Response = "Found $count items" }
        Write-Host "✅ ($count items)" -ForegroundColor Green
    } catch {
        $results += @{ Source = $test.Name; Status = "❌ ERREUR"; Category = $test.Category; Response = $_.Exception.Message }
        Write-Host "❌" -ForegroundColor Red
    }
}

# 4. Test Collection (si disponible)
Write-Host "`n🔄 Test Collection..." -ForegroundColor Yellow
try {
    $url = "$baseUrl/api/admin/collect"
    Write-Host "  Test Manual Collect... " -NoNewline
    $response = Invoke-RestMethod -Uri $url -Method POST -TimeoutSec 60 -ErrorAction Stop
    $total = ($response.result.totalSaved + $response.result.totalSkipped)
    $results += @{ Source = "Manual Collect"; Status = "✅ OK"; Category = "Admin"; Response = "Processed $total items" }
    Write-Host "✅ (Processed $total items)" -ForegroundColor Green
} catch {
    $results += @{ Source = "Manual Collect"; Status = "❌ ERREUR"; Category = "Admin"; Response = $_.Exception.Message }
    Write-Host "❌" -ForegroundColor Red
}

# Résumé
Write-Host "`n============================" -ForegroundColor Cyan
Write-Host "📋 RÉSUMÉ DES RÉSULTATS" -ForegroundColor Cyan
Write-Host "============================" -ForegroundColor Cyan

# Grouper par catégorie
$grouped = $results | Group-Object -Property Category

foreach ($group in $grouped) {
    Write-Host "`n[$($group.Name)]" -ForegroundColor Magenta
    foreach ($item in $group.Group) {
        $color = if ($item.Status -like "✅*") { "Green" } else { "Red" }
        Write-Host "  $($item.Source): " -NoNewline
        Write-Host $item.Status -ForegroundColor $color
    }
}

# Statistiques
Write-Host "`n📊 STATISTIQUES" -ForegroundColor Cyan
$okCount = ($results | Where-Object { $_.Status -like "✅*" }).Count
$totalCount = $results.Count
$percent = [math]::Round(($okCount / $totalCount) * 100, 1)
Write-Host "  Fonctionnels: $okCount / $totalCount ($percent%)" -ForegroundColor Green
Write-Host "  Erreurs: $($totalCount - $okCount)" -ForegroundColor Red

# Sauvegarder les résultats
$jsonOutput = $results | ConvertTo-Json -Depth 3
$jsonOutput | Out-File -FilePath "source-test-results.json" -Encoding UTF8
Write-Host "`n💾 Résultats sauvegardés dans: source-test-results.json" -ForegroundColor Cyan
