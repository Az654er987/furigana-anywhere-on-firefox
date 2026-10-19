# Fork Firefox

Fork de [bobbybelcher1/furigana-anywhere](https://github.com/bobbybelcher1/furigana-anywhere)
(MIT), adapté pour Firefox et signé par Mozilla (canal non listé), avec mises à jour
automatiques.

## Adaptations Firefox

- `manifest.json` : `background.scripts` en plus de `service_worker` (Firefox ne gère pas
  les service workers d'extension ; Chrome ignore `scripts`), bloc
  `browser_specific_settings.gecko` (identifiant, URL de mise à jour, déclaration de
  non-collecte de données).
- `dict/jmdict.json` est livré compressé (`jmdict.json.gz`) : Mozilla refuse de signer un
  fichier texte de plus de 5 Mo. `content.js` le décompresse au chargement.
- `lib/kuromoji.js` : `Function('return this')()` remplacé par `globalThis` (évaluation
  bloquée par la CSP des extensions MV3), et `path.join` remplacé par une concaténation
  pour les URL des dictionnaires (il transformait `moz-extension://` en `moz-extension:/`).

Le code reste compatible Chrome.

## Publier une version

1. Monter `version` dans `manifest.json` (elle doit toujours augmenter).
2. Pousser sur `main`.

Le workflow `release.yml` valide, fait signer par Mozilla (quelques minutes à une
demi-heure), crée la release GitHub et met à jour `updates.json`. Firefox installe la
nouvelle version à sa prochaine vérification (environ une fois par jour, ou
`about:addons` → roue dentée → « Rechercher des mises à jour »).

Secrets requis : `AMO_JWT_ISSUER` et `AMO_JWT_SECRET`.

## Tester sans signer

`about:debugging#/runtime/this-firefox` → « Charger un module complémentaire temporaire »
→ choisir `manifest.json`. Désactiver d'abord la version installée (même identifiant).

## Récupérer les nouveautés de l'auteur

```bash
git fetch upstream
git merge upstream/main
```

En cas de conflit sur `dict/jmdict.json` (mis à jour par l'auteur), regénérer la version
compressée : `gzip -9 -c dict/jmdict.json > dict/jmdict.json.gz && git rm dict/jmdict.json`.

## Interrupteur On/Off (ajout du fork)

L'extension est **désactivée par défaut** : un interrupteur en haut du popup l'allume
ou l'éteint, comme dans Yomitan, et l'icône affiche un badge « ON » quand elle est active.

- Éteinte, aucun script n'est injecté dans les pages : `background.js` n'enregistre
  les content scripts (`scripting.registerContentScripts`) que lorsque `sp_active` vaut
  `true`, au lieu de les déclarer dans le manifest.
- En l'allumant, elle démarre tout de suite dans l'onglet courant (injection depuis le
  popup), sans recharger la page. En l'éteignant, l'interface est retirée des onglets
  ouverts ; le petit script de détection des sous-titres déjà présent dans ces pages ne
  disparaît qu'au rechargement.
