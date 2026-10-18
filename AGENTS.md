This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Architecture & Déploiement : Web PWA (Vercel) & Supabase

L'application est exploitée et distribuée en version **Web en ligne (PWA) déployée sur Vercel** avec backend temps réel **Supabase** et gestion de version GitHub. La version Android / APK autonome (EAS Build) n'est plus utilisée.

- **Build Web & Vercel** : Le build est exécuté via `npm run build` (`expo export -p web`), produisant les fichiers statiques dans le dossier `dist/` pour Vercel.
- **Backend & Temps réel** : Supabase PostgreSQL, Auth & Realtime Channels.
- **PWA & Offline** : Mode standalone configuré pour navigateurs mobiles et desktop.

## Commands

```bash
npx expo install <package>  # Utiliser pour installer des dépendances compatibles SDK
npm run start / npm run web # Lancer le serveur de développement web
npm run build               # Exporter l'application web pour Vercel (expo export -p web)
npm run lint                # Linter
npx tsc --noEmit            # Vérification des types TypeScript
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Méthodologie Git & Déploiements Vercel

- **Toutes les modifications se font sur une branche dédiée sous forme de Pull Request (PR)**.
- **Avant de pousser sur une branche existante, TOUJOURS vérifier si sa PR est encore en cours (`OPEN`) ou déjà mergée (`MERGED`)** via `git fetch origin` et `gh pr view <num> --json state`. Si la PR a été mergée sur `main`, créer systématiquement une nouvelle branche à partir de `origin/main` et ouvrir une nouvelle PR.
- **NE JAMAIS déclencher de déploiement direct ni merger la PR soi-même**.
- Laisser la PR ouverte sur GitHub avec son lien pour que l'utilisateur puisse la tester via le lien Preview automatique de Vercel.
- L'utilisateur est seul décisionnaire du moment où la PR est mergée sur `main` afin d'éviter les doubles déploiements simultanés sur Vercel.


