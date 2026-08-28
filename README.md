# 🎵 MusikBox — Votre lecteur multimédia local

Une application **100 % locale**, pensée comme un **lecteur multimédia type Spotify** :
rechercher des **sons et des vidéos**, les **écouter directement**, les **télécharger**
et les organiser avec des **playlists intelligentes** — le tout dans une interface
**verre dépoli (glassmorphism) + bois verni**.

Elle utilise les mêmes services que le portail analysé
(`eurostylealuminium.co.za`, un clone Tubidy) mais **sans publicités**,
**sans page intermédiaire**, et en **sauvegardant vos morceaux sur votre disque**.

---

## 🚀 Démarrer

**Option 1 — double-clic :**
- Windows : double-cliquez sur `lancer_musikbox.bat`
- macOS / Linux : double-cliquez sur `lancer_musikbox.command`
  (ou `chmod +x lancer_musikbox.sh && ./lancer_musikbox.sh`)

**Option 2 — terminal :**
```bash
cd musikbox
python3 server.py
```

Puis ouvrez votre navigateur sur : **http://localhost:8787**

> Python 3.8+ requis, aucune autre dépendance. Internet est nécessaire pour
> chercher / télécharger ; la **bibliothèque locale** reste lisible hors-ligne.

---

## 🧭 L'application

```
┌─────────────┬──────────────────────────────────────┐
│  SIDEBAR    │   Recherche / vues                   │
│  · Accueil  │   · Tendances · Genres · Playlists   │
│  · Rechercher                                      │
│  · Bibliothèque                                    │
│  · Favoris   └──────────────┬───────────────────────┘
│  · Playlists                │  LECTEUR (fixe, bas)  │
│  · Téléchargements          │  vinyle animé, seek,  │
└─────────────┴───────────────┴── volume, file d'attente
```

### 🎧 Recherche multimédia
- Barre de recherche avec **suggestions en direct**
- Onglets **Tout / Sons / Vidéos** (détection automatique)
- **17 genres** (Afro, Amapiano, Gospel, Hip-Hop…) → **playlists YouTube** → morceaux

### ▶️ Lecture
- **Lecteur intégré** : audio en streaming MP3, **vidéos en mode cinéma 🎬** (plein écran)
- **File d'attente** (suivant / précédent / vider), barre de progression cliquable
- Raccourcis clavier : `Espace` lecture/pause · `←`/`→` · `Échap` fermer
- **Reprise de lecture** depuis l'accueil + **historique d'écoute**

### ✨ Playlists intelligentes (calculées automatiquement)
| Playlist | Contenu |
|---|---|
| 💾 Ma bibliothèque | Tous vos fichiers téléchargés |
| 🕘 Récemment écoutés | Votre historique d'écoute |
| 🔥 Plus écoutés | Vos morceaux les plus passés |
| 🎧 Coups de cœur | Vos favoris |
| ✨ Découverte | Tendances mélangées (aléatoire) |
| 🤝 Similaires | Sons proches de votre écoute actuelle |
| 📝 Mes playlists | Playlists **personnalisées** (bouton ＋ sur chaque morceau) |

### ⤓ Téléchargements
- **MP3 audio** ou **MP4 vidéo** (avec taille affichée), barre de progression en direct
- Détection des doublons (pas de double téléchargement)
- **Historique persistant** des téléchargements + statistiques (nombre, espace utilisé)
- Coller un lien ou un titre dans « Téléchargements » pour lancer directement
- Fichiers stockés dans `library/`, **lisibles hors-ligne**, supprimables depuis l'app

### ♥ Favoris & synchronisation locale
Favoris, historiques, playlists et compteurs sont conservés dans votre navigateur
(localStorage) ; la bibliothèque et l'historique des téléchargements côté serveur.

---

## 🏗️ Comment ça marche (l'analyse du site)

Le site analysé est un **portail Tubidy** : indexation de vidéos YouTube et conversion
MP3/MP4. Son « API » :

1. **Recherche** : `GET /search?q=…` (HTML) — titre, vignette, durée, lien `/download/{titre}/video/{id}`
2. **Page détail** : jeton chiffré `payload` (Laravel)
3. **Formats** : `POST /api/video/formats` → JSON MP3/MP4 + tailles
4. **Lecture** : `POST /api/video/play` → lien de streaming direct (`*.mp3?play`)
5. **Téléchargement** : `POST /api/video/download` → lien direct (`*.mp3?download`)

**MusikBox fait le reverse-proxy de tout cela côté serveur local** (aucun CORS,
publicités ignorées, flux proxifiés avec support `Range` pour la recherche dans la piste).

### Structure

```
musikbox/
├── server.py               ← serveur local (reverse-proxy + bibliothèque + historique DL)
├── lancer_musikbox.bat     ← lanceur Windows
├── lancer_musikbox.sh      ← lanceur macOS / Linux
├── static/
│   ├── index.html          ← interface (sidebar style lecteur multimédia)
│   ├── style.css           ← design system verre + bois verni
│   ├── app.js              ← lecteur audio/vidéo, playlists IA, téléchargements
│   └── assets/wood.jpg     ← texture bois verni
└── library/                ← VOS MP3/MP4 téléchargés (créé automatiquement)
```

---

## ⚖️ Note légale

Outil destiné à un **usage personnel**. Le téléchargement de musique peut
enfreindre les droits d'auteur selon votre pays et le contenu concerné.
Utilisez-le uniquement pour des contenus que vous êtes autorisé à télécharger
(domaine public, licences libres, contenus dont vous détenez les droits…).
MusikBox n'héberge aucun fichier : tout passe par le site tiers.
