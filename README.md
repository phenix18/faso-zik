# FASO-ZIK — faso musique

Plateforme de streaming **audio et video** pour les artistes du Burkina Faso :
ecoute en ligne, telechargement **quand l'artiste l'autorise**, espace artiste
complet et **platine DJ deux voies** integree au navigateur.

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![Licence](https://img.shields.io/badge/licence-MIT-green)

---

## Ce que fait le site

| Domaine | Fonctions |
|---|---|
| **Ecoute** | Lecteur global persistant (audio + clips video), file d'attente, aleatoire, repetition, plein ecran video, raccourcis clavier |
| **Catalogue** | Nouveautes, plus ecoutes, genres, clips, fiches artistes, recherche titres / artistes / genres / langues |
| **Autorisations de l'artiste** | Trois droits independants par morceau — ecoute, telechargement, usage en platine — tous refuses par defaut et verifies **cote serveur** |
| **Espace artiste** | Depot audio/video avec barre de progression, pochette, metadonnees, licence declaree, statistiques d'ecoute et de telechargement, retrait d'un titre |
| **Bibliotheque** | Favoris et playlists par compte |
| **Platine DJ** | Deux platines, crossfader a puissance constante, EQ 3 bandes + filtre balayable, pitch ±16 %, cue, boucles calees au tempo, SYNC, forme d'onde cliquable |

---

## Origine du code : la fusion demandee

Le projet part de deux depots.

### `himanshu8443/hayasaka` — repris

Application Next.js 14 (app router) de streaming musical. En ont ete repris
**l'architecture et les schemas** : lecteur global pilote par Redux Toolkit,
authentification NextAuth par identifiants, organisation `app/` + `components/`
+ `services/`, mise en page Tailwind sombre, favoris et playlists lies au
compte.

Ce qui a **change** : hayasaka lit un catalogue tiers (API non officielle
JioSaavn). FASO-ZIK heberge **son propre catalogue**, alimente par les artistes
eux-memes ; les appels vers l'API externe ont donc ete remplaces par une base
locale et un stockage de fichiers, et le modele de donnees a gagne la notion
d'autorisation par morceau, absente de l'original.

### `Emblemsestitch65/virtualdj-pro-automation` — inutilisable

Ce depot est **vide**. Son unique commit contient un `README.md` qui decrit
trois fichiers (`env_setup.sh`, `config.json`, `deploy.py`), un dossier `src/`
reduit a un `.gitkeep`, et un `.project_status.json`. Aucun code n'y figure —
c'est la signature classique des depots-vitrines qui servent d'appat autour des
logiciels « cracks ». Rien n'en a donc ete fusionne, et je deconseille de
telecharger ce que ce genre de depot annonce ailleurs.

La platine a ete **ecrite de zero** avec l'API Web Audio
(`src/components/dj/`), ce qui donne au passage un resultat superieur a ce
qu'un script d'automatisation VirtualDJ aurait offert : elle tourne dans le
navigateur, sans logiciel a installer, et se limite d'elle-meme aux titres que
les artistes ont ouverts au mix.

---

## Demarrage

```sh
npm install
cp .env.example .env.local          # puis renseigner NEXTAUTH_SECRET
npm run seed                        # catalogue de demonstration (audio inclus)
npm run dev                         # http://localhost:3000
```

`npm run seed` fabrique aussi les fichiers audio (WAV de synthese a differents
tempos) : le lecteur et la platine sont utilisables immediatement.

Comptes de demonstration — mot de passe `fasozik2024` :
`yennenga@faso-zik.bf`, `bobo.kanou@faso-zik.bf`, `sahel.digital@faso-zik.bf`.

### Scripts

| Commande | Role |
|---|---|
| `npm run dev` / `build` / `start` | cycle Next.js habituel |
| `npm run seed` | jeu de demonstration (idempotent) |
| `npm run db:reset` | efface base et medias locaux |
| `npm run check` | verifie que toutes les icones importees existent |
| `npm run lint` | ESLint |

### Variables d'environnement

Voir `.env.example`. Les indispensables :

- `NEXTAUTH_SECRET` — cle de signature des sessions (`openssl rand -base64 32`)
- `NEXTAUTH_URL` — URL publique du site
- `MEDIA_ROOT` — dossier des fichiers deposes (volume persistant)
- `DATABASE_FILE` — fichier SQLite
- `MAX_AUDIO_MB`, `MAX_VIDEO_MB`, `MAX_IMAGE_MB` — limites de depot

---

## Architecture

```
src/
  app/
    api/            routes serveur (auth, tracks, stream, download, upload, ...)
    dj/             page platine
    studio/         espace artiste
    titre/ artistes/ titres/ clips/ recherche/ favoris/ playlists/
  components/
    player/         lecteur global
    dj/             platine (useDeck, Deck, Waveform, DjConsole)
    studio/         depot et gestion des autorisations
  lib/
    db.js           schema SQLite et migrations
    repo/           acces aux donnees (users, artists, tracks, library)
    storage.js      ecriture et resolution des medias
    permissions.js  droits accordes par l'artiste
    http.js         reponses Range, JSON, erreurs
    auth.js         options NextAuth et session serveur
```

### Choix techniques

**SQLite plutot qu'un serveur de base.** Le site heberge lui-meme les fichiers
audio et video : il lui faut de toute facon un volume disque persistant, donc
un VPS ou un conteneur. Dans ce cadre un moteur embarque evite un service de
plus a exploiter. Tout l'acces aux donnees passe par `src/lib/repo/*` : migrer
vers PostgreSQL revient a reecrire ces quatre modules, pas l'application.

**Streaming avec en-tetes Range (HTTP 206).** Sans reponse partielle, un
navigateur ne peut ni deplacer la tete de lecture dans une video ni reprendre
un telechargement coupe. `src/lib/http.js` implemente la RFC 7233, y compris la
forme suffixe (`bytes=-500`) et le refus `416` hors limites.

**Un seul element de lecture pour l'audio et la video.** Un `<video>` unique
joue les MP3 comme les clips ; deux moteurs concurrents auraient signifie deux
files d'attente a synchroniser.

**Platine : decodage integral en memoire.** Chaque morceau charge en platine est
decode en `AudioBuffer`. C'est ce qui rend possible le saut de position
instantane, la boucle calee a l'echantillon et le trace de la forme d'onde —
trois choses qu'un flux `<audio>` ne permet pas.

---

## Le modele d'autorisation

C'est le coeur du site. Chaque morceau porte trois drapeaux independants :

| Champ | Effet | Defaut |
|---|---|---|
| `allow_stream` | ecoute en ligne | actif |
| `allow_download` | telechargement du fichier | **inactif** |
| `allow_dj` | chargement dans la platine | **inactif** |

L'artiste les modifie a tout moment depuis son studio. Les verifications se font
dans les routes serveur (`src/lib/permissions.js`) :

- `/api/stream/[id]` refuse `403` si `allow_stream` est retire ;
- `/api/download/[id]` refuse `403` sans `allow_download`, meme si l'URL est
  devinee ou partagee ;
- le bac a disques de la platine ne contient que les titres `allow_dj` ;
- `PATCH` et `DELETE` sur un morceau sont refuses a tout compte autre que
  l'artiste proprietaire (ou un administrateur).

L'interface se contente de refleter ces drapeaux : masquer un bouton n'est
jamais la protection.

---

## Verifications effectuees

Build de production, puis parcours reels contre le serveur demarre :

- lecture complete `200` et partielle `206`, suffixe `bytes=-N`, hors limites `416` ;
- telechargement autorise `200` avec `Content-Disposition`, refuse `403` sinon ;
- bascule d'un droit dans le studio, suivie de l'effet immediat sur `/api/download` ;
- `PATCH` refuse `403` pour un anonyme **et** pour un autre artiste ;
- tentative de traversee de repertoire sur `/api/asset` : `404` ;
- inscription, connexion, depot d'un fichier, lecture de sa duree, suppression ;
- platine pilotee au navigateur : chargement des deux voies, avance de la tete
  de lecture, pitch +6 % (110 → 116,6 BPM), SYNC alignant la seconde platine,
  boucle 4 temps, crossfader — sans erreur console ni requete en echec.

---

## Mise en production

Le site a besoin d'un **disque persistant** (medias + base). Un conteneur avec
un volume monte sur `storage/` et `data/`, ou un VPS, conviennent. Sur une
plateforme sans systeme de fichiers durable (Vercel et assimiles), il faut
d'abord deplacer `src/lib/storage.js` vers un stockage objet (S3, Cloudflare R2)
et `src/lib/db.js` vers une base geree.

Points a traiter avant ouverture au public :

1. `NEXTAUTH_SECRET` unique et secret ;
2. HTTPS et un proxy inverse devant l'application ;
3. sauvegarde de `data/` et `storage/` ;
4. limitation de debit sur `/api/register`, `/api/upload` et `/api/auth` ;
5. procedure de retrait (DMCA / droits voisins) et verification que chaque
   deposant detient bien les droits sur ce qu'il publie.

---

## Licence

MIT — voir `LICENSE`. Les enregistrements deposes restent la propriete de leurs
artistes ; la licence porte sur le code, pas sur le catalogue.
