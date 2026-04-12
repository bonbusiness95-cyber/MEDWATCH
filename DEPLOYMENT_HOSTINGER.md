# Déploiement sur Hostinger pour MedWatch

Ce projet est une application Node + React qui nécessite un hébergement Hostinger compatible Node.js et SSH.

## Prérequis Hostinger
- Compte Hostinger avec support Node.js.
- Accès SSH activé dans le panneau hPanel.
- Dossier distant configuré pour votre application Node.
- Variables d'environnement Firebase (service account ou JSON) gérées séparément.

## 1) Préparer les variables d'environnement
Dans PowerShell ou dans votre environnement VS Code, définissez au minimum :

```powershell
$env:HOSTINGER_SSH_HOST = "example.hostinger.com"
$env:HOSTINGER_SSH_USER = "username"
$env:HOSTINGER_SSH_PORT = "22"
$env:HOSTINGER_SERVER_PATH = "/home/username/medwatch"
```

Optionnel :

```powershell
$env:HOSTINGER_SSH_KEY_PATH = "C:\Users\User\.ssh\id_rsa"
$env:HOSTINGER_REMOTE_START_COMMAND = "node dist/server.js"
```

> Si Hostinger gère le démarrage automatiquement via l’interface Node.js, laissez `HOSTINGER_REMOTE_START_COMMAND` vide.

## 2) Déployer depuis l’IDE
Ouvrez un terminal PowerShell à la racine du projet, puis lancez :

```powershell
npm run deploy:hostinger
```

Ce script effectue :
- `npm run build`
- transfert de `dist`, `package.json`, `package-lock.json` et `firebase-applet-config.json`
- installation des dépendances distantes via `npm install --production`
- exécution optionnelle de la commande de démarrage distante

## 3) Configurer Hostinger
- Assurez-vous que le chemin `HOSTINGER_SERVER_PATH` correspond au dossier Node.js du serveur Hostinger.
- Configurez le démarrage de l’application dans Hostinger si la commande distante n’est pas exécutée automatiquement.
- Ajoutez vos secrets Firebase dans le panneau Hostinger ou via un fichier `.env.production` sécurisé.

## 4) Note importante
Si votre abonnement Hostinger ne propose pas de Node.js, l’application ne fonctionnera pas correctement en mode serveur. Dans ce cas, il faudra utiliser un autre hébergement Node ou déployer le front-end statique séparément.
