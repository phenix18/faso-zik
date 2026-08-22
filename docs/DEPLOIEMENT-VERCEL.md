# Mettre FASO-ZIK en ligne sur Vercel

Le site ne garde rien sur son propre disque : celui d'une fonction est
ephemere. La base et les fichiers vivent donc a l'exterieur.

| Piece | Role |
|---|---|
| **Vercel** | sert les pages et les routes |
| **PostgreSQL** | comptes, catalogue, paiements — Supabase, Neon, ou un Postgres a soi |
| **Stockage objet** | les fichiers deposes par les artistes — Supabase Storage, ou tout stockage compatible S3 |

---

## 1. La base

Creez un projet PostgreSQL et relevez sa chaine de connexion.

Sur Supabase, prenez l'adresse du **pooler en mode transaction** (port 6543),
pas l'acces direct : une plateforme sans serveur ouvre beaucoup de connexions
courtes, qu'un acces direct saturerait.

```
DATABASE_URL=postgresql://postgres.projet:motdepasse@aws-0-eu-west-3.pooler.supabase.com:6543/postgres
```

Le schema s'applique tout seul au premier demarrage : tout y est conditionnel,
il n'y a pas de migration a lancer a la main.

## 2. Le stockage

Creez un seau (bucket) **prive** nomme `faso-zik`. Prive est important : les
fichiers ne doivent etre joignables que par les adresses signees que
l'application delivre apres avoir verifie les autorisations.

Deux fournisseurs sont acceptes. Renseigner les variables de l'un ou de
l'autre suffit a le choisir ; `STOCKAGE_FOURNISSEUR` ne sert qu'a trancher si
les deux sont presents.

### Supabase Storage

```
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_KEY=...   # cle de service, jamais exposee au navigateur
SUPABASE_BUCKET=faso-zik
```

### Compatible S3 — Cloudflare R2, Backblaze B2, MinIO

```
S3_ENDPOINT=https://<identifiant-de-compte>.r2.cloudflarestorage.com
S3_BUCKET=faso-zik
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=auto             # "auto" chez R2 ; la region reelle ailleurs
```

**Pourquoi cette option existe.** Le trafic sortant est le poste qui coute le
plus cher a un site de musique : chaque ecoute est un fichier servi. R2 ne le
facture pas, la ou un quota gratuit classique s'epuise en quelques milliers
d'ecoutes.

**Le seau doit accepter les envois du navigateur.** Les artistes deposent
directement au stockage, depuis votre domaine : sans regle CORS, le navigateur
refuse l'envoi avant meme de le tenter. Chez R2, dans les reglages du seau :

```json
[
  {
    "AllowedOrigins": ["https://votre-domaine.example"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

La lecture, elle, ne passe pas par le navigateur en requete croisee :
l'application redirige vers l'adresse signee, le navigateur la suit comme une
adresse ordinaire.

## 3. Le projet Vercel

Reliez le depot, puis renseignez les variables de `.env.example` dans
**Settings → Environment Variables**. Les indispensables :

- `DATABASE_URL`
- `SUPABASE_URL` et `SUPABASE_SERVICE_KEY`, ou `S3_ENDPOINT`, `S3_BUCKET`,
  `S3_ACCESS_KEY_ID` et `S3_SECRET_ACCESS_KEY`
- `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL`

Puis deployez.

## 4. Le controle d'installation

Avant d'ouvrir le site, passez le controle. Il ne lit pas les variables : il
s'en sert. Il ouvre la base, compte ses tables, depose un objet temoin dans le
seau, le relit par une adresse signee, compare les octets, puis l'efface.

```sh
DATABASE_URL=... S3_ENDPOINT=... S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
NEXTAUTH_SECRET=... npm run verifier
```

Ce qui est bloquant empeche le site de fonctionner ; ce qui est en reserve le
laisse tourner en le diminuant — pas de reinitialisation de mot de passe sans
SMTP, pas de vente serieuse avec le fournisseur de simulation.

Une seule chose lui echappe : la regle CORS du seau. Elle ne se voit que depuis
un navigateur, sur votre domaine.

## 5. Le catalogue de demonstration

```sh
DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run seed
# ou, avec un stockage compatible S3 :
DATABASE_URL=... S3_ENDPOINT=... S3_BUCKET=... S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... npm run seed
```

Le script fabrique les fichiers audio et les depose : le lecteur et la platine
sont utilisables tout de suite.

---

## Ce qui change par rapport a un serveur a soi

**Le fichier depose ne passe pas par l'application.** Le navigateur prepare la
version d'ecoute (MP3 128 kbit/s), demande une adresse d'envoi signee, depose
directement au stockage, puis previent le serveur. C'est ce qui permet de
deposer un clip de plusieurs centaines de megaoctets : aucune fonction
n'accepterait un tel corps de requete.

**Le tempo est mesure dans le navigateur**, sur le fichier deja decode pour
l'encodage. Meme methode qu'avant, sans serveur de transcodage.

**Les clips ne sont pas decoupes en HLS.** Cela demandait ffmpeg, absent du
runtime. Le clip est servi tel qu'il a ete depose : conseillez a vos artistes
de deposer des fichiers deja compresses.

**La lecture passe par une redirection signee.** L'application verifie
l'autorisation puis renvoie vers le stockage, qui sert les octets et repond aux
requetes partielles. Une adresse signee vaut quelques minutes.

**La limitation de debit est comptee en base.** En memoire, elle n'aurait rien
limite : chaque instance aurait eu son propre compteur.

## Le plan Hobby ne convient pas a un site qui vend

FASO-ZIK encaisse des paiements et prend une commission : c'est un usage
commercial, que le plan Hobby de Vercel exclut. Prevoyez un plan Pro avant
d'ouvrir la vente.

## Developpement local

```sh
npm install
cp .env.example .env.local
npm run dev
```

Sans `DATABASE_URL`, un PostgreSQL en memoire (PGlite) prend le relais : meme
dialecte SQL qu'en production, aucun service a lancer. Les depots, eux,
demandent un stockage configure.

```sh
npm test   # 85 tests, sur ce meme PostgreSQL en memoire
```
