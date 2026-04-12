# 🔧 Configuration Firebase pour Render

## ⚠️ Problème Identifié

Si aucune donnée n'est collectée depuis le déploiement, c'est très probablement parce que **Firebase n'est pas configuré** sur Render.

L'application démarre correctement sans Firebase, mais **la collection de données ne fonctionne pas** sans les credentials Firebase.

## ✅ Solution: Ajouter Firebase Credentials sur Render

### Étape 1: Obtenir votre Service Account JSON

1. Allez sur [Google Cloud Console](https://console.cloud.google.com)
2. Sélectionnez votre projet MEDWATCH
3. Aller à **APIs & Services** → **Credentials**
4. Vous devriez voir une clé "Firebase Admin SDK" déjà créée
5. Cliquez sur elle → **Keys tab** → **Add Key** → **Create new key** → **JSON**
6. Téléchargez le fichier JSON

**OU directement depuis Firebase:**

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet
3. Allez à **⚙️ Settings** (gear icon en haut)
4. Tab **"Service accounts"**
5. Cliquez **"Generate new private key"**
6. Gardez le fichier JSON généré

### Étape 2: Créer la Variable d'Environnement sur Render

1. Allez à [Render Dashboard](https://dashboard.render.com)
2. Cliquez sur votre service **medwatch**
3. Allez à **Environment** tab
4. Cliquez **"Add Environment Variable"**
5. Configurez:
   - **Key:** `FIREBASE_SERVICE_ACCOUNT_JSON`
   - **Value:** Collez **TOUT le contenu** du fichier JSON (c'est du texte multi-lignes)

6. Cliquez **"Save changes"**

### Étape 3: Déclencher un Redéploiement

1. Allez à **Deploys** tab de votre service
2. Cliquez **"Manual Deploy"** ou
3. Poussez un commit sur GitHub pour déclencher auto-deploy

L'application va relancer et lire la variable `FIREBASE_SERVICE_ACCOUNT_JSON`.

---

## 🔍 Vérifier que ça Marche

### Vérification 1: Logs Render

1. Allez à votre service → **Logs**
2. Cherchez:
   - ✅ `✅ Firebase Admin initialized from environment variable` → **OK!**
   - ❌ `⚠️ Firebase Admin not initialized` → **Firebase encore pas configuré**

### Vérification 2: Tester la Collection Manuellement

Depuis votre app déployée:
```bash
curl -X POST https://medwatch.onrender.com/api/admin/collect
```

Vous devriez voir:
```json
{
  "success": true,
  "result": {
    "totalSaved": 15,
    "totalSkipped": 8,
    "duration": "23.45"
  }
}
```

### Vérification 3: Vérifier Firestore

1. Allez à [Firebase Console](https://console.firebase.google.com)
2. Sélectionnez votre projet
3. Allez à **Firestore Database**
4. Ouvrez la collection **"articles"**
5. Vous devriez voir les articles collectés avec:
   - `status: "pending"` (articles pertinents)
   - `status: "other"` (articles non pertinents, filtrés)
   - `category: "medication"`, `"guideline"`, `"rare_case"`, ou `"other"`
   - `created_at: timestamp`

---

## 🚨 Dépannage

### Si vous recevez "Authentication failed"

- ❌ Vous avez copié un JSON invalide
- ✅ Solution: Téléchargez à nouveau depuis Firebase/GCP, collez TOUT sans modification

### Si vous recevez "Maximum call stack exceeded"

- ❌ JSON mal formaté (manque de guillemets, etc)
- ✅ Solution: Collez le JSON avec la validation JSON online avant

### Si collection retourne 0 saved/skipped

- ❌ Il y a peut-être des erreurs avec les sources individuelles (rate limits, etc)
- ✅ Solution: Vérifiez les logs Render pour les erreurs spécifiques

---

## 📋 Checklist Configuration

- [ ] Service Account JSON téléchargé depuis Firebase
- [ ] Variable `FIREBASE_SERVICE_ACCOUNT_JSON` créée sur Render
- [ ] Redéploiement effectué
- [ ] Logs Render montrent `✅ Firebase Admin initialized`
- [ ] Collection manuelle testée: `curl -X POST https://medwatch.onrender.com/api/admin/collect`
- [ ] Firestore Database affiche des articles

---

## 💡 Info Supplémentaire

- La collection automatique s'exécute toutes les **6 heures** après le déploiement
- La première collection commence après **30 secondes** du démarrage
- Vous pouvez forcer la collection manuellement via `/api/admin/collect`

Une fois Firebase configuré, l'application collectera automatiquement les données! 🚀
