# Mettre FASO-ZIK en ligne sur Vercel

Le site ne garde rien sur son propre disque : celui d'une fonction est
ephemere. La base et les fichiers vivent donc a l'exterieur.

| Piece | Role |
|---|---|
| **Vercel** | sert les pages et les routes |
| **PostgreSQL** | comptes, catalogue, paiements — Supabase, Neon, ou un Postgres a soi |
| **Stockage objet** | les fichiers deposes par les artistes — Supabase Storage |

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

```
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SERVICE_KEY=...   # cle de service, jamais exposee au navigateur
SUPABASE_BUCKET=faso-zik
```

## 3. Le projet Vercel

Reliez le depot, puis renseignez les variables de `.env.example` dans
**Settings → Environment Variables**. Les indispensables :

- `DATABASE_URL`
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `NEXTAUTH_SECRET` (`openssl rand -base64 32`), `NEXTAUTH_URL`
- `NEXT_PUBLIC_SITE_URL`

Puis deployez.

## 4. Le catalogue de demonstration

```sh
DATABASE_URL=... SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run seed
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
