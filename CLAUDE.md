# Reperes pour travailler sur FASO-ZIK

## Ce qu'il faut savoir avant de toucher au code

**Les autorisations sont la regle centrale.** Trois drapeaux par morceau —
`allow_stream`, `allow_download`, `allow_dj` — plus `price_cfa` pour la vente.
Ils se verifient dans `src/lib/permissions.js`, appele par les routes serveur.
Masquer un bouton n'est jamais la protection : si une adresse existe, elle doit
refuser d'elle-meme.

**Le fichier depose n'est pas celui qu'on diffuse.** L'original sert au
telechargement autorise ; la version d'ecoute (MP3, ou HLS pour les clips) est
fabriquee par `src/lib/transcodeQueue.js` apres la reponse au depot.
`playbackSource()` decide lequel servir.

**Tout l'acces aux donnees passe par `src/lib/repo/*`.** Aucune requete SQL
ailleurs. C'est ce qui rend une migration vers PostgreSQL circonscrite.

## Commandes

```sh
npm run dev      # developpement
npm test         # 116 tests, sans dependance de test
npm run check    # verifie que les icones importees existent
npm run lint
npm run seed     # catalogue de demonstration, fichiers audio compris
npm run db:reset # efface base et medias locaux
```

`npm test` utilise `node:test` avec un resolveur d'alias maison
(`tests/alias-hooks.mjs`) pour importer `@/...` sans transpilation.

## Pieges rencontres, a ne pas refaire

- **`outputFileTracingExcludes` casse la sortie autonome** dans Next 14.2 : le
  traceur sur-exclut et laisse de cote des modules internes. Le nettoyage se
  fait apres coup, dans `scripts/clean-standalone.mjs`.
- **`instrumentation.js` est compile aussi pour le runtime Edge**, ou le pilote
  SQLite n'existe pas. La reprise des transcodages part donc de la mise en page
  racine.
- **Les icones `react-icons` inexistantes ne cassent pas la compilation** : le
  composant vaut `undefined` et React plante au rendu, parfois dans une branche
  rare. D'ou `npm run check`.
- **hls.js s'attache de facon asynchrone** : appeler `play()` juste apres le
  changement de morceau ne marche pas. Le demarrage se fait dans
  `useMediaSource`, une fois la source posee.
- **Le fournisseur de paiement `simulation` laisse l'acheteur se declarer
  paye.** Il est refuse en production sauf autorisation explicite. Ne pas
  relacher ce garde-fou.

## Conventions

Le code, les commentaires et l'interface sont en francais, sans accents dans
les identifiants et les chaines du code (les bases de donnees et les
en-tetes HTTP les supportent mal selon les environnements). Les commentaires
expliquent **pourquoi**, pas ce que le code fait deja lire.
