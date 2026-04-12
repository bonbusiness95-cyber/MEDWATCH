# Guide de Déploiement - MedWatch AI sur Render

## 📦 Prérequis

- Compte GitHub avec votre repo MedWatch
- Compte Render (https://render.com)
- Clé API Gemini configurée

## 🚀 Étapes de Déploiement

### 1. Pousser le Code sur GitHub

```bash
git add .
git commit -m "Préparation pour déploiement Render"
git push origin main
```

### 2. Créer le Service sur Render

1. Allez à https://dashboard.render.com
2. Cliquez sur **"New +"** → **"Web Service"**
3. Connectez votre compte GitHub (si ce n'est pas déjà fait)
4. Sélectionnez le repo: `MEDWATCH`
5. Configurez:
   - **Name:** `medwatch`
   - **Environment:** Node
   - **Region:** Choose sélectionnez la région la plus proche
   - **Branch:** `main`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Plan:** Starter (gratuit)

### 3. Configurer les Variables d'Environnement

Dans le panneauRender:

1. Allez à **Environment**
2. Ajoutez les variables suivantes:

| Clé | Valeur |
|-----|--------|
| NODE_ENV | production |
| PORT | 3000 |
| GEMINI_API_KEY | AIzaSyC4fr8DQiGP6VO75LduPfIuSnaOyac2FBg |
| APP_URL | https://medwatch.onrender.com |

### 4. Déployer

1. Cliquez sur **"Deploy"**
2. Attendez environ 5-10 minutes
3. Une fois prêt, vous verrez le statut "Live"
4. Accédez à votre app: `https://medwatch.onrender.com`

## 🔐 Configuration Firebase (Important)

Pour que l'authentification Google fonctionne:

1. Allez sur Firebase Console: https://console.firebase.google.com
2. Sélectionnez votre projet
3. Allez à **Authentication** > **Sign-in method**
4. Activez "Google"
5. Dans **Settings**, ajoutez votre domaine Render:
   - `medwatch.onrender.com`
   - `https://medwatch.onrender.com`

## ✅ Tests de Déploiement

Une fois déployé, testez:

```bash
# Vérifier que l'app répond
curl https://medwatch.onrender.com

# Tester l'API PubMed
curl https://medwatch.onrender.com/api/pubmed/search?term=cancer&reldate=7

# Tester l'API RSS
curl https://medwatch.onrender.com/api/rss?url=https://feeds.bbci.co.uk/news/rss.xml
```

## 📊 Monitoring

- **Logs:** Allez à **Logs** dans le dashboard Render
- **Metrics:** Allez à **Metrics** pour les CPU/Memory
- **Health:** Render fait des health checks automatiques

## 🐛 Dépannage

### Problème: "Build failed"
- Vérifiez les logs Render
- S'assurer que `npm install` et `npm run build` marchent en local

### Problème: "Application Keep Crashing"
- Vérifiez que PORT est défini à 3000 dans env
- Vérifiez la clé GEMINI_API_KEY

### Problème: "Firebase auth ne fonctionne pas"
- Vérifiez que le domaine Render est ajouté à Firebase Console

### Problème: "Port already in use"
- Render isole chaque service, donc pas de conflit possible
- C'est uniquement un problème en développement local

## 📈 Améliorations Futures

- [ ] Ajouter Redis pour le caching
- [ ] Ajouter une base de données PostgreSQL standalone
- [ ] Configurer SSL automatique (Render le fait par défaut)
- [ ] Mettre en place des webhooks GitHub pour CI/CD

## 🔄 Mise à Jour du Code

Pour mettre à jour:

```bash
# Localement
git add .
git commit -m "Votre message"
git push origin main
```

Render redéploiera automatiquement quand vous pourez vers `main`.

## 📞 Support

- **Render Support:** https://support.render.com
- **Gemini API Support:** https://ai.google.dev/support
- **Firebase Support:** https://firebase.google.com/support

---

✅ **Votre application MedWatch est maintenant prête pour la production !**
