# Reperes pour travailler sur FASO-ZIK

## Ce qu'il faut savoir avant de toucher au code

**Les autorisations sont la regle centrale.** Trois drapeaux par morceau —
`allow_stream`, `allow_download`, `allow_dj` — plus `price_cfa` pour la vente.
Ils se verifient dans `src/lib/permissions.js`, appele par les routes serveur.
Masquer un bouton n'est jamais la protection : si une adresse existe, elle doit
refuser d'elle-meme.

**Le fichier depose n'est pas celui qu'on diffuse.** L'original sert au
telechargement autorise ; la version d'ecoute (MP3 128 kbit/s) est fabriquee
**dans le navigateur** avant l'envoi (`src/lib/navigateur/`). `playbackSource()`
decide lequel servir.

**L'application ne fait jamais passer les octets d'un media.** Elle verifie
l'autorisation puis redirige vers une adresse signee du stockage. Au depot,
c'est l'inverse : le navigateur envoie directement au stockage, avec une
adresse signee que l'application lui a delivree.

**Tout l'acces aux donnees passe par `src/lib/repo/*`.** Aucune requete SQL
ailleurs, et tout y est asynchrone.

## Commandes

```sh
npm run dev      # developpement
npm test         # 87 tests, sans dependance de test
npm run check    # verifie que les icones importees existent
npm run lint
npm run seed     # catalogue de demonstration, fichiers audio compris
npm run admin -- adresse@exemple.bf
```

`npm test` utilise `node:test` avec un resolveur d'alias maison
(`scripts/alias-hooks.mjs`, charge par `--import ./scripts/register.mjs`) pour
importer `@/...` sans transpilation. Les scripts en ligne de commande passent
par le meme resolveur : sans lui, ils cassent des qu'une bibliotheque qu'ils
traversent utilise l'alias.

Sans `DATABASE_URL`, un PostgreSQL en memoire (PGlite) prend le relais : meme
dialecte qu'en production, aucun service a lancer. C'est ce qui fait tourner
les tests.

## Pieges rencontres, a ne pas refaire

- **Un middleware Next ne tourne qu'en runtime Edge**, ou aucun pilote de base
  n'existe. La limitation de debit sur la connexion est donc posee autour du
  gestionnaire NextAuth, dans sa propre route.
- **PGlite embarque du WebAssembly**, interdit en Edge : les deux pilotes sont
  declares dans `serverComponentsExternalPackages`, et rien qui touche a la
  base ne doit remonter dans un fichier compile pour Edge.
- **Les icones `react-icons` inexistantes ne cassent pas la compilation** : le
  composant vaut `undefined` et React plante au rendu, parfois dans une branche
  rare. D'ou `npm run check`.
- **Les entiers larges reviennent parfois en chaine** selon le pilote : les
  tailles de fichier passent par `Number()` avant d'aller au navigateur.
- **Le fournisseur de paiement `simulation` laisse l'acheteur se declarer
  paye.** Il est refuse en production sauf autorisation explicite. Ne pas
  relacher ce garde-fou.

## Conventions

Le code, les commentaires et l'interface sont en francais, sans accents dans
les identifiants et les chaines du code (les bases de donnees et les
en-tetes HTTP les supportent mal selon les environnements). Les commentaires
expliquent **pourquoi**, pas ce que le code fait deja lire.
