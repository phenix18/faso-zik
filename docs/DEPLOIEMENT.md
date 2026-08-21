# Mettre FASO-ZIK en ligne

Le site heberge lui-meme les fichiers audio et video : il lui faut un disque
qui survit aux redemarrages. Un VPS modeste suffit pour commencer.

- **Machine** : 2 vCPU, 2 Go de memoire vive, et surtout du disque. Comptez
  environ 1 Go pour 250 titres en MP3, beaucoup plus des qu'il y a des clips.
- **Nom de domaine** pointant sur l'adresse IP de la machine (enregistrement A).
- **Docker** et le plugin Compose.

---

## 1. Installation

```sh
git clone https://github.com/phenix18/faso-zik.git
cd faso-zik
cp .env.example .env
```

Renseignez `.env` :

```sh
# Indispensable : sans secret propre, les sessions de tout le monde sont forgeables.
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://votre-domaine.bf
NEXT_PUBLIC_SITE_URL=https://votre-domaine.bf

# Utilise par Caddy pour obtenir le certificat TLS.
FASO_ZIK_DOMAIN=votre-domaine.bf

# Adresses reellement relevees : elles s'affichent sur la page /droits.
NEXT_PUBLIC_CONTACT_RIGHTS=droits@votre-domaine.bf
NEXT_PUBLIC_CONTACT_GENERAL=contact@votre-domaine.bf
```

Puis :

```sh
docker compose up -d --build
```

Caddy demande le certificat des que le domaine resout vers la machine. Comptez
une minute au premier demarrage.

Pour partir avec un catalogue de demonstration :

```sh
docker compose exec app node scripts/seed.mjs
```

---

## 2. Ce que fait chaque piece

| Piece | Role |
|---|---|
| `app` | l'application Next.js en mode autonome, sur le port 3000, jamais expose directement |
| `caddy` | HTTPS automatique, compression, et transmission de `X-Forwarded-For` |
| `./data` | la base SQLite — **a sauvegarder** |
| `./storage/media` | les fichiers deposes par les artistes — **a sauvegarder** |

Deux details du `Caddyfile` comptent :

- `max_size 500MB` : sans cette ligne, le proxy couperait le depot d'un clip
  bien avant que l'application ne voie passer quoi que ce soit. Gardez-la
  au-dessus de `MAX_VIDEO_MB`.
- `flush_interval -1` : le streaming repose sur des reponses partielles ; mettre
  ces reponses en tampon rendrait poussif le deplacement dans un morceau.

La limitation de debit s'appuie sur `X-Forwarded-For`. Caddy le renseigne
lui-meme. Si vous mettez un autre proxy **devant** Caddy (Cloudflare par
exemple), verifiez qu'il fait de meme, sans quoi tout le trafic sera compte
comme venant d'une seule adresse.

---

## 3. Sauvegardes

```sh
docker compose exec app node scripts/backup.mjs /app/data/sauvegardes
```

Le script copie la base par l'API de sauvegarde de SQLite — pas par `cp`, qui
donnerait une archive corrompue si une ecriture est en cours — puis archive les
medias.

En tache planifiee, tous les jours a 3 h :

```cron
0 3 * * * cd /chemin/vers/faso-zik && docker compose exec -T app node scripts/backup.mjs /app/data/sauvegardes
```

Copiez ensuite ces archives **hors de la machine**. Une sauvegarde restee sur
le meme disque ne protege de rien.

---

## 4. Mise a jour

```sh
git pull
docker compose up -d --build
```

Les migrations de schema s'appliquent au premier acces a la base : les colonnes
ajoutees apres coup sont posees par `ALTER TABLE` au demarrage. Faites tout de
meme une sauvegarde avant une mise a jour.

---

## 5. Sans Docker

```sh
npm ci
npm run build
MEDIA_ROOT=/var/lib/faso-zik/media \
DATABASE_FILE=/var/lib/faso-zik/faso-zik.db \
NEXTAUTH_SECRET=... \
npm start
```

Placez un proxy inverse devant (Nginx, Caddy) avec HTTPS, `X-Forwarded-For` et
une taille de corps de requete suffisante, et confiez le processus a systemd.

`npm run build` produit aussi `.next/standalone`, qui peut se deployer seul avec
`.next/static` copie a cote — c'est ce que fait l'image Docker.

---

## 6. Verifie, et ce qui ne l'est pas

Ont ete verifies sur cette machine :

- le demarrage du serveur autonome avec le module natif SQLite ;
- l'arborescence exacte que produit le `Dockerfile`, reproduite fichier par
  fichier : le catalogue de demonstration s'y cree, le serveur y repond, la
  sauvegarde s'y execute, et la sonde de sante repond ;
- la configuration Compose (`docker compose config`).

**Ce qui n'a pas pu l'etre** : la construction de l'image elle-meme, faute de
daemon Docker sur la machine de developpement. Lancez `docker compose
up -d --build` une premiere fois sur un poste avec Docker avant de compter
dessus en production.
