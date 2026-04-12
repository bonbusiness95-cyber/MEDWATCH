# 📋 Checklist de Déploiement MedWatch AI sur Render

## ✅ Vérifications Pré-Déploiement

- [x] Code validé avec TypeScript (`npm run lint`)
- [x] Build de production compilée (`npm run build`)
- [x] Fichier `server.js` généré dans `dist/`
- [x] `render.yaml` configuré
- [x] `.env.production` créé avec clés d'API
- [x] Fichiers sensibles dans `.gitignore`
- [x] Scripts de déploiement documentés

## 🔐 Sécurité

- [x] GEMINI_API_KEY ne sera jamais committed
- [x] Secrets stockés dans Render Environment variables
- [x] `.env*` ignoré par git (sauf `.env.example`)
- [x] Node.js mode production activé

## 📦 Dépendances

Toutes les dépendances sont installées avec `npm install`:

```
@google/genai - Analyse IA avec Gemini
firebase - Authentification et Firestore
react / react-dom - Interface utilisateur
vite - Build rapide
express - Serveur API
```

## 🚀 Instructions de Déploiement

### 1. Préparation GitHub

```bash
# Assurez-vous que tous les fichiers sont commités
git status

# Pushez vers main
git push origin main
```

### 2. Déploiement sur Render

1. Allez à: https://dashboard.render.com
2. Cliquez: **New** → **Web Service**
3. Connectez GitHub si nécessaire
4. Sélectionnez: `MEDWATCH` repo
5. Confirmez les paramètres:
   - Name: `medwatch`
   - Environment: Node
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

### 3. Configuration des Variables

Ajoutez à Render **Environment**:

```
NODE_ENV = production
PORT = 3000
GEMINI_API_KEY = AIzaSyC4fr8DQiGP6VO75LduPfIuSnaOyac2FBg
APP_URL = https://medwatch.onrender.com
```

### 4. Déployer

- Cliquez: **Deploy**
- Attendez 5-10 minutes
- Vérifiez le statut: "Live"
- Accédez: `https://medwatch.onrender.com`

## ✅ Tests Post-Déploiement

```bash
# Test basique
curl https://medwatch.onrender.com

# Test API
curl https://medwatch.onrender.com/api/pubmed/search?term=cancer

# Test santé
curl https://medwatch.onrender.com/health
```

## 🐛 Dépannage

| Problème | Solution |
|----------|----------|
| Build failed | Vérifiez les logs, testez `npm run build` localement |
| App crashes | Vérifiez `PORT=3000` et `GEMINI_API_KEY` |
| Firebase auth failed | Ajoutez domaine Render à Firebase Console |
| Port already in use | Render isole les services, pas de conflit possible |

## 📊 Monitoring en Production

- **Logs:** Render Dashboard → Service → Logs
- **Metrics:** Render Dashboard → Service → Metrics
- **Uptime:** Render fait des health checks auto

## 🔄 Mise à Jour du Code

```bash
# Localement
git add .
git commit -m "Description des changements"
git push origin main

# → Render redéploie automatiquement
```

## 💡 Astuce: Redéployer Manuellement

Si vous devez redéployer sans changement de code:
1. Allez à Render Dashboard
2. Sélectionnez votre service
3. Cliquez: **Manual Deploy** → **Deploy latest commit**

---

**🎉 Bravo! MedWatch AI est maintenant en production!**
