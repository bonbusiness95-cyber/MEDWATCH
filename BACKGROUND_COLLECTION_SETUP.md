# ⚙️ Configuration de la Collecte Automatique

## 📋 Prérequis

La collecte automatique en arrière-plan nécessite **Firebase Admin SDK** configuré avec un compte de service.

## 🔑 Obtenir la clé de service Firebase

### Dans Firebase Console :
1. Aller à **Paramètres du projet** → **Comptes de service**
2. Cliquer sur **Générer nouvelle clé privée**
3. Un fichier JSON sera téléchargé : `firebase-service-account.json`

### 🚨 SÉCURITÉ : Action IMPORTANTE
**NE PAS** committer ce fichier dans Git ! Ajouter à `.gitignore` :
```bash
echo "firebase-service-account.json" >> .gitignore
```

## 📂 Installation de la clé

### Option 1 : Placer à la racine du projet
```
MEDWATCH/
├── firebase-service-account.json  ← Place here
├── server.ts
├── package.json
└── ...
```

### Option 2 : Utiliser une variable d'environnement
Dans `.env.local` ou `.env.production` :
```
FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/firebase-service-account.json
GEMINI_API_KEY=your_gemini_key
```

## 🚀 Démarrer avec la collecte

### En développement
```bash
npm run dev
```
La collecte commence automatiquement 30 secondes après le démarrage du serveur.

### Installation des dépendances
```bash
npm install
```

## 📊 Collecte automatique

### ⏰ Horaire
- **Initial** : 30 secondes après le démarrage
- **Récurrent** : Tous les 6 heures

### 🔗 Sources collectées
1. **PubMed** (articles médicaux scientifiques)
2. **ClinicalTrials.gov** (essais cliniques)
3. **Europe PMC** (articles de recherche)
4. **Flux RSS** (NEJM, The Lancet, FDA, EMA, WHO, etc.)
5. **Web Scraping** (FDA, EMA, NEJM, ESC Guidelines, etc.)
6. **OpenFDA** (alertes médicaments)

## 🎯 Pour tester manuellement

### Curl
```bash
curl -X POST http://localhost:3000/api/admin/collect
```

### Dans le navigateur
Ouvrir la console JavaScript et exécuter :
```javascript
fetch('/api/admin/collect', { method: 'POST' })
  .then(r => r.json())
  .then(data => console.log(data));
```

### Bouton Dashboard
Cliquer sur le bouton **"Rafraîchir"** du dashboard.

## 📈 Monitoring

Les logs du serveur affichent :
```
📡 Starting background medical watch collection...
✅ PubMed: saved 5, skipped 2
✅ ClinicalTrials: saved 3, skipped 1
✅ Europe PMC: saved 4, skipped 3
✅ RSS: saved 15, skipped 8
✅ Scrape: saved 10, skipped 5
✅ OpenFDA: saved 2, skipped 1

✅ Collection complete in 42.15s
📊 Total: 39 saved, 20 skipped
```

## 🔍 Vérifier les articles collectés

### Firebase Console
1. Firestore Database
2. Collection **"articles"**
3. Les articles doivent apparaître avec `status: "pending"`

### Via API
```bash
curl http://localhost:3000/api/health
```

## ⚠️ Dépannage

### Pas d'articles collectés ?

**1. Firebase Admin non initialisé**
```
⚠️ Firebase Admin not initialized - background collection will not work
```
→ Vérifier que `firebase-service-account.json` existe

**2. Erreurs de connexion à Firestore**
```
❌ PubMed error: Code AUTH_FAILED
```
→ Vérifier les **Firestore Rules** :
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /articles/{document=**} {
      allow read, write: if true;  // Temporaire pour test
    }
  }
}
```

**3. Erreurs de CORS ou réseau**
```
❌ RSS error: ECONNREFUSED
```
→ Vérifier la connexion Internet et les pare-feu

## 🎬 Déploiement sur Render

### Ajouter la clé de service

1. Aller à **Settings** → **Environment Variables**
2. Ajouter `FIREBASE_SERVICE_ACCOUNT_PATH` pointant vers le chemin du fichier
3. Uploader le fichier JSON via **Files** section

### Variables d'environnement requises
```
GEMINI_API_KEY=...
FIREBASE_SERVICE_ACCOUNT_PATH=firebase-service-account.json
PORT=10000
NODE_ENV=production
```

## ✅ Checklist avant production

- [ ] Fichier `firebase-service-account.json` obtenu
- [ ] Ajouté à `.gitignore`
- [ ] Firestore Rules configurées
- [ ] `npm install` exécuté
- [ ] Test manuel avec `/api/admin/collect`
- [ ] Articles visibles dans Firestore
- [ ] Logs du serveur affichent les collectes
