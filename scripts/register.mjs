/**
 * Installe le resolveur d'alias avant tout le reste.
 *
 * A passer a Node par `--import` : les tests et les scripts en ligne de
 * commande importent alors les modules de l'application tels quels, avec
 * leurs chemins `@/...`.
 */
import { register } from "node:module";

register("./alias-hooks.mjs", import.meta.url);
