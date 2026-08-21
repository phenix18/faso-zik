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
| **Platine DJ** | Deux platines, crossfader a puissance constante, EQ 3 bandes + filtre balayable, pitch ±16 %, cue, boucles calees au tempo, SYNC, forme d'onde cliquable, tempo mesure automatiquement |
| **Droits** | Declaration obligatoire du deposant, page publique de procedure de retrait, limitation de debit sur inscription, connexion et depot |
| **Vie du site** | Abonnement a un artiste et page des sorties suivies, classement hebdomadaire, lecteur integrable dans un site exterieur, espace d'administration |
| **Paiement** | Achat d'un titre et soutien libre a un artiste par mobile money (Orange Money, Moov Money, Wave), revenus et part du site dans le studio |
| **Reseau lent** | Transcodage a l'arrivee : MP3 128 kbit/s pour l'ecoute, clips decoupes en HLS 360p/720p, mode economie de donnees, application installable qui s'ouvre hors connexion |
| **Exploitation** | Image Docker, Compose avec proxy HTTPS, sauvegardes, integration continue et 93 tests |

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
| `npm test` | 93 tests : autorisations, plages HTTP Range, chemins de medias, limitation de debit, catalogue, transcodage, tempo, paiements, abonnements et administration |
| `npm run seed` | jeu de demonstration (idempotent) |
| `npm run backup` | sauvegarde de la base et des medias |
| `npm run admin -- adresse@exemple.bf` | promeut un compte existant en administrateur |
| `npm run db:reset` | efface base et medias locaux |
| `npm run check` | verifie que toutes les icones importees existent |
| `node scripts/generate-icons.mjs` | regenere les icones de l'application |
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
    (site)/         coquille du site : navigation et lecteur global
    embed/          lecteur integrable, sans coquille
    (site)/dj/      page platine
    (site)/studio/  espace artiste
    (site)/admin/   espace d'administration
    (site)/droits/  procedure de retrait et engagements
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
    rateLimit.js    limitation de debit par fenetre glissante
    transcode.js    versions allegees (MP3, HLS) et affiches
    bpm.js          mesure du tempo
    paiement/       fournisseurs mobile money
  middleware.js     freine les essais de mot de passe sur /api/auth
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

**Le fichier depose n'est pas celui qu'on diffuse.** Un artiste depose
volontiers un WAV de 40 Mo ou un clip en 1080p ; c'est inecoutable en donnees
mobiles. A l'arrivee, ffmpeg fabrique une version d'ecoute — MP3 128 kbit/s
pour l'audio, HLS 360p et 720p pour les clips — pendant que l'original est
conserve pour le telechargement. Sur le catalogue de demonstration : 12,1 Mo
deposes, 2,2 Mo reellement diffuses ; sur un clip 1080p de 19,4 Mo, 1,2 Mo en
360p.

Le transcodage tourne **apres** la reponse au depot, un travail a la fois : sur
un petit serveur, deux encodages video simultanes rendraient le site
injoignable. Le titre reste ecoutable dans sa version d'origine en attendant, et
le studio affiche l'avancement. ffmpeg reste facultatif : sans lui, les fichiers
d'origine sont servis tels quels.

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

### En amont : la declaration du deposant

Aucun fichier n'entre au catalogue sans que son deposant ait declare detenir les
droits sur l'enregistrement. La case est obligatoire dans le formulaire, et le
serveur rejette le depot en `422` si la declaration manque — un envoi direct a
l'API n'y echappe pas. La declaration est stockee avec le morceau
(`tracks.rights_confirmed`). La page publique `/droits` decrit la procedure de
retrait et ce a quoi le deposant s'engage.

### Limitation de debit

| Point d'entree | Limite | Fenetre |
|---|---|---|
| `/api/register` | 5 comptes | 1 heure |
| `/api/upload` | 20 depots | 1 heure |
| `/api/auth/callback`, `/api/auth/signin` | 12 tentatives | 5 minutes |

Le compteur vit en memoire, ce qui suffit au deploiement vise (une instance,
un volume). Derriere plusieurs instances, remplacer la `Map` de
`src/lib/rateLimit.js` par Redis suffit : le reste du module ne bouge pas.

---

## Le tempo, mesure et non declare

La platine a besoin d'un BPM pour caler ses boucles et aligner deux morceaux.
Le demander a l'artiste marche mal : le champ reste vide, ou porte une valeur
approximative. Il est donc mesure sur le signal (`src/lib/bpm.js`) : enveloppe
d'energie, fonction d'attaques, autocorrelation, avec deux garde-fous contre
l'erreur d'octave — une ponderation perceptive, qui empeche la structure d'une
mesure de passer pour le temps, et un test d'alternance d'intensite, qui
reconnait un contretemps au lieu de doubler le tempo. Une valeur saisie par
l'artiste prime toujours sur la mesure.

Verifie sur quatorze signaux de reference : le catalogue de demonstration
(6 tempos connus) et huit motifs construits pour mettre la methode en defaut —
contretemps, swing, bruit, frappe imprecise, tempo non entier, morceaux lent et
rapide. Quatorze sur quatorze a moins de 2 BPM. Le parametre d'etalement de la
ponderation a ete **calibre sur ces signaux** : sur de la musique reelle et
variee, une erreur d'octave reste possible — d'ou le champ modifiable.

---

## Paiement mobile money

Au Burkina Faso l'argent circule par Orange Money, Moov Money et les
portefeuilles voisins. L'application ne parle jamais a un operateur en direct :
elle passe par un fournisseur choisi dans `PAIEMENT_FOURNISSEUR`, qui expose
quatre operations (`src/lib/paiement/`).

Deux usages : **acheter le telechargement** d'un titre au prix fixe par
l'artiste, et **soutenir un artiste** par un pourboire libre depuis sa page. Le
studio affiche l'encaisse, la part du site et le net a reverser.

Trois regles tenues cote serveur :

- le montant d'un achat vient du prix enregistre, jamais du navigateur ;
- `/api/download` renvoie `402` tant que l'achat n'est pas conclu, meme si le
  lien est devine ou partage ;
- un paiement deja conclu n'est jamais rejoue : les notifications d'un
  agregateur arrivent parfois en double ou dans le desordre.

`simulation` est le fournisseur par defaut : il rejoue le cycle complet — y
compris les echecs — sans compte marchand, ce qui rend la chaine testable de
bout en bout. Dans ce mode, la route de notification est **fermee** : sans
verification de signature, elle laisserait n'importe qui se declarer paye.

`agregateur` est une **ossature, pas une integration validee**. Les noms de
champs et la methode de signature different d'un prestataire a l'autre et
changent avec le temps. Confrontez `src/lib/paiement/agregateur.js` a la
documentation en vigueur et testez en bac a sable avant de basculer.

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
  boucle 4 temps, crossfader — sans erreur console ni requete en echec ;
- limitation de debit : 5 inscriptions passent, la 6e recoit `429` avec
  `Retry-After` ; 12 tentatives de connexion passent, les suivantes `429` ;
- depot refuse en `422` sans declaration de droits, accepte avec, y compris en
  appelant l'API directement sans passer par le formulaire ;
- **54 tests automatises** (`npm test`, sans dependance de test) sur les
  autorisations, les plages HTTP Range, la resolution des chemins de medias, la
  limitation de debit et le catalogue. Leur utilite a ete controlee en
  introduisant deux regressions volontaires — telechargement toujours permis,
  traversee de repertoire debloquee : les deux ont ete rattrapees ;
- serveur autonome demarre avec le module natif SQLite, arborescence du
  `Dockerfile` reproduite fichier par fichier, catalogue de demonstration et
  sauvegarde executes dedans, sonde de sante saine ;
- transcodage de bout en bout : depot d'un WAV et d'un clip 1080p, versions
  allegees fabriquees en arriere-plan, playlist HLS et segments servis,
  traversee de repertoire refusee sur `/api/hls` ;
- chaine HLS suivie dans le navigateur — playlist maitresse, puis variante
  360p, puis premier segment. Le decodage lui-meme n'a pas pu etre observe :
  le Chromium de test est une version sans H.264 ni AAC. C'est ce qui a permis
  de verifier le repli automatique vers le fichier complet ;
- application installable : service worker actif, manifeste complet, coquille
  en cache, page de secours affichee reseau coupe ;
- parcours d'achat complet : `402` avant paiement, paiement ouvert puis
  confirme, `200` apres, second achat refuse, un autre auditeur toujours
  bloque ; pourboire encaisse, revenus et commission justes ;
- notifications de paiement : refusees sans signature, avec une signature
  erronee, et avec un corps modifie apres signature ; refusees aussi tant que
  le fournisseur est celui de simulation ;
- detection du tempo : 14 signaux de reference, tous a moins de 2 BPM ;
- administration : action refusee en `403` sans le role, role relu dans la
  session sans reconnexion, titre retire absent du catalogue public et du
  classement ;
- lecteur integrable : servi sans la coquille du site, `X-Frame-Options` retire
  sur cette seule route et remplace par `frame-ancestors`, conserve partout
  ailleurs.

---

## Mise en production

```sh
cp .env.example .env      # renseigner NEXTAUTH_SECRET et FASO_ZIK_DOMAIN
docker compose up -d --build
```

Marche a suivre complete, sauvegardes et mise a jour : **[docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md)**.

Le site a besoin d'un **disque persistant** (medias + base). Un conteneur avec
un volume monte sur `storage/` et `data/`, ou un VPS, conviennent. Sur une
plateforme sans systeme de fichiers durable (Vercel et assimiles), il faut
d'abord deplacer `src/lib/storage.js` vers un stockage objet (S3, Cloudflare R2)
et `src/lib/db.js` vers une base geree.

Points a traiter avant ouverture au public :

1. `NEXTAUTH_SECRET` unique et secret ;
2. HTTPS et un proxy inverse devant l'application — la limitation de debit lit
   `x-forwarded-for`, le proxy doit donc le renseigner lui-meme ;
3. sauvegarde de `data/` et `storage/` ;
4. adresses de contact reelles dans `NEXT_PUBLIC_CONTACT_RIGHTS` et
   `NEXT_PUBLIC_CONTACT_GENERAL`, relevees par une personne joignable ;
5. si le site tourne sur plusieurs instances, compteur de debit partage
   (voir `src/lib/rateLimit.js`).

---

## Ce qui n'est pas fait, volontairement

**Les commentaires.** Ouvrir un espace de commentaires sans equipe pour le
moderer se retourne toujours contre les artistes. La brique est simple a
ecrire ; c'est la moderation qui coute, et elle ne s'automatise pas.

**L'envoi d'e-mails.** Les abonnements alimentent une page de nouveautes, pas
une lettre d'information : cela demanderait un service d'envoi, une gestion des
desabonnements et une reputation d'expediteur a tenir.

**Le reversement automatique aux artistes.** Les sommes sont comptees et
affichees ; le virement vers leur compte mobile money reste manuel, faute
d'API de paiement sortant verifiee.

---

## Licence

MIT — voir `LICENSE`. Les enregistrements deposes restent la propriete de leurs
artistes ; la licence porte sur le code, pas sur le catalogue.
