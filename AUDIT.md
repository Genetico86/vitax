# 🛡️ Audit Complet & Plan de Remédiation — VITAX

> **Document évolutif de suivi** — Cochez les cases (`- [x]`) au fur et à mesure de la résolution des fiches et sous-actions.
> - **Stack audité** : Expo SDK 54 / React Native 0.81.5 / React 19.1 (Web PWA Vercel), `expo-sqlite` (WASM Web + natif), Zustand 5, Supabase (`@supabase/supabase-js` PostgreSQL + Realtime).

---

## 📊 Tableau de Bord d'Avancement

| Niveau | 🔴 Critique | 🟠 Majeur | 🟡 Mineur | Progression |
| :--- | :---: | :---: | :---: | :---: |
| **Niveau 1 — Technique & Sécurité** | **2 / 2** ✅ | **4 / 5** | **1 / 2** | **7 / 9 (78%)** |
| **Niveau 2 — Fonctionnel, Métier & UX/UI** | 0 / 0 | **5 / 5** ✅ | **2 / 3** | **7 / 8 (88%)** |
| **TOTAL** | **2 / 2 (100%)** | **9 / 10 (90%)** | **3 / 5 (60%)** | **14 / 17 (82%)** |

---

## 🗺️ Feuille de Route par Sprints (Check-list Globale)

### Sprint 1 — Urgences Sécurité (Bloquant Production) ✅ TERMINÉ
- [x] **[Fiche 1.1]** Sécuriser l'authentification (hachage PBKDF2-HMAC-SHA256 + `pgcrypto` RPC, suppression des mots de passe en clair en BDD et dans `AsyncStorage`, fermeture de la faille d'Account Takeover).
- [x] **[Fiche 1.2]** Activer `ROW LEVEL SECURITY` (RLS) sur les 14 tables Supabase, restreindre la lecture de `password`/`password_hash` et supprimer les clés en dur de `supabaseClient.ts`.
- [x] **[Fiche 1.3]** Éliminer les interpolations de chaînes non filtrées dans les filtres PostgREST `.or()`.
- [x] **[Fiche 1.4]** Valider les fichiers JSON d'import avec un contrôle strict de taille (10 Mo max), de schéma et de bornes numériques avant insertion SQLite et push Cloud.
- [x] **[Fiche 1.7]** Renforcer les en-têtes HTTP de sécurité dans `vercel.json` (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`).

### Sprint 2 — Fiabilité Métier & Cohérence Fonctionnelle ✅ TERMINÉ
- [x] **[Fiche 2.1]** Unifier la formule de calcul d'XP entre `active.tsx`, `workoutSessionStore.ts` et `summary.tsx`.
- [x] **[Fiche 2.2]** Créditer réellement le `rewardXp` des Trophées/Achievements débloqués dans le total d'XP.
- [x] **[Fiche 2.3]** Brancher la validation automatique des défis entre amis (`completeFriendChallenge`) à la fin d'une séance.
- [x] **[Fiche 2.4]** Appliquer l'unité `KG / LBS` choisie dans les réglages sur tous les écrans de saisie, historique et partage.
- [x] **[Fiche 2.8]** Remplacer tous les `Alert.alert` restants par `showAlert`, autoriser le zoom d'accessibilité (`+html.tsx`) et ajouter la suppression complète du compte Cloud (RGPD).

### Sprint 3 — Performance, Données & Résilience
- [x] **[Fiche 1.6]** Supprimer le watchdog arbitraire de 2500 ms au démarrage SQLite et utiliser un verrou d'initialisation (`initDbPromise` / `openDbPromise`).
- [x] **[Fiche 1.8]** Remplacer le polling de 10 s de `FriendInviteNotificationBanner` par Supabase Realtime et coordonner l'événement `pagehide`/`beforeunload` entre `db.ts` et `cloudSyncService.ts`.
- [ ] **[Fiche 1.5]** Créer les tables relationnelles dédiées pour remplacer le détournement de `public.trades.offered_pokemon`.

### Sprint 4 — Qualité de Code & Finitions UX/UI
- [x] **[Fiche 2.5]** Persister le chronomètre de course/marche (`startTimestamp`, `accumulatedSeconds`, `activityType`) dans `AsyncStorage`.
- [x] **[Fiche 2.6]** Identifier les profils bots dans l'Arène (`isBot: true` / badge `🤖 Coach IA`) et masquer l'action d'ajout en ami sur ces profils.
- [ ] **[Fiche 2.7]** Contenir la largeur Desktop Web (`maxWidth: 480`) et masquer les boutons de simulation derrière `__DEV__`.
- [ ] **[Fiche 1.9]** Découper les fichiers monolithiques ("God Files") et ajouter des tests unitaires (`vitest` / `jest`) sur les services critiques.

---

# PARTIE 1 — NIVEAU 1 : TECHNIQUE & SÉCURITÉ

---

## - [x] Fiche 1.1 — Authentification maison & Mots de passe stockés en clair ✅ CORRIGÉ
- **Catégorie** : Sécurité & Vulnérabilités (OWASP A02:2021 Cryptographic Failures / A07:2021 Identification and Authentication Failures)
- **Priorité** : 🔴 **Critique (Blocant / Faille majeure)**
- **Actions correctives réalisées** :
  - [x] Création de `src/utils/cryptoSecurity.ts` avec hachage **PBKDF2-HMAC-SHA256** (60 000 itérations, Web Crypto API + repli pur JS conforme RFC 2898) et comparaison en temps constant (`constantTimeEqual`).
  - [x] Ajout des fonctions RPC serveur `SECURITY DEFINER` (`register_trainer_secure` et `authenticate_trainer_secure` avec `pgcrypto` bcrypt) et synchronisation Supabase Auth dans `src/services/authService.ts` et `src/database/supabase_schema.sql`, avec migration automatique transparente des anciens mots de passe en clair.
  - [x] Fermeture de la faille d'**Account Takeover** sur les comptes sans mot de passe et suppression totale du stockage de mots de passe en clair dans `@vitax_local_creds` (purgé lors de `logoutTrainer`).

---

## - [x] Fiche 1.2 — Désactivation totale du RLS & Accès `GRANT ALL` au rôle public `anon` ✅ CORRIGÉ
- **Catégorie** : Sécurité API & Gestion des Données (OWASP A01:2021 Broken Access Control)
- **Priorité** : 🔴 **Critique (Blocant / Faille majeure)**
- **Actions correctives réalisées** :
  - [x] Activation de `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` sur les 14 tables de `src/database/supabase_schema.sql`.
  - [x] Création de la fonction `public.current_vitax_user_id()`, révocation de `SELECT (password, password_hash)` sur `public.profiles` pour `anon`/`authenticated`, et écriture des politiques RLS d'isolation par propriétaire sur chaque table.
  - [x] Suppression des constantes `DEFAULT_SUPABASE_URL` et `DEFAULT_SUPABASE_ANON_KEY` en dur dans `src/services/supabaseClient.ts` et propagation automatique de l'identifiant authentifié via `x-client-info` (compatible CORS Supabase).

---

## - [x] Fiche 1.3 — Injection de filtres PostgREST via interpolation de chaînes dans `.or()` ✅ CORRIGÉ
- **Catégorie** : Sécurité & Vulnérabilités (OWASP A03:2021 Injection)
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives réalisées** :
  - [x] Validation stricte de tous les identifiants via `sanitizePostgrestIdentifier` (`/^[A-Za-z0-9_-]{1,64}$/`) dans `src/utils/cryptoSecurity.ts`.
  - [x] Remplacement du `.or(and(...))` de `removeFriend` par deux requêtes paramétrées `.eq()` et assainissement des clauses `.or()` dans `getPendingFriendRequests` (`friendsService.ts`), `getFriendChallenges` (`friendChallengeService.ts`) et `getFriendGifts` (`friendGiftService.ts`).

---

## - [x] Fiche 1.4 — Absence de validation de schéma lors de l'import JSON de sauvegarde ✅ CORRIGÉ
- **Catégorie** : Sécurité & Intégrité des données (OWASP A08:2021 Software and Data Integrity Failures)
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives réalisées** :
  - [x] Vérification de la structure complète et encadrement strict des chaînes (`safeStr`) et bornes numériques (`safeNum`) sur toutes les tables importées dans `src/database/backupService.ts`.
  - [x] Limitation de la taille maximale de fichier à 10 Mo (`MAX_BACKUP_FILE_BYTES`) avant `JSON.parse` et plafonnement du nombre d'entrées par collection.

---

## - [ ] Fiche 1.5 — Détournement de la table `public.trades` et du champ `offered_pokemon` (Héritage Pokérom)
- **Catégorie** : Architecture & Qualité du code / Dette technique
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives à cocher** :
  - [ ] Créer des tables relationnelles dédiées pour les entités manquantes (`deleted_entities`, `active_workouts`, `daily_bonuses`) dans `src/database/supabase_schema.sql`.
  - [ ] Supprimer les écritures en double dans `public.trades` depuis `src/services/cloudSyncService.ts`.

---

## - [x] Fiche 1.6 — Race condition au démarrage entre le Watchdog UI (2,5s) et l'initialisation SQLite ✅ CORRIGÉ
- **Catégorie** : Exploitation, Résilience & Gestion des erreurs
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives réalisées** :
  - [x] Implémentation des verrous de promesse partagés (`openDbPromise` et `initDbPromise`) dans `getDatabase()` et `initDatabase()` (`src/database/db.ts`) afin de dédupliquer toute ouverture ou initialisation concurrente.
  - [x] Allongement du chien de garde de sécurité à 8 000 ms dans `src/app/_layout.tsx` pour laisser le seed SQLite WASM se terminer proprement sur appareil lent.

---

## - [x] Fiche 1.7 — En-têtes de sécurité HTTP incomplets sur Vercel (`vercel.json`) ✅ CORRIGÉ
- **Catégorie** : Sécurité Infrastructure & Déploiement Web PWA
- **Priorité** : 🟡 **Mineur (Optimisation)**
- **Actions correctives réalisées** :
  - [x] Ajout de `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` et `Permissions-Policy: camera=(self), microphone=(), geolocation=()` dans `vercel.json`.

---

## - [x] Fiche 1.8 — Surconsommation réseau (Polling 10s + Course critique `beforeunload`) ✅ CORRIGÉ
- **Catégorie** : Performance & Scalabilité
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives réalisées** :
  - [x] Remplacement du `setInterval(checkPendingRequests, 10000)` de `src/components/social/FriendInviteNotificationBanner.tsx` par un abonnement Supabase Realtime (`vitax-friend-invites-live` sur `public.friend_requests`) avec rafraîchissement à la reprise d'onglet (`visibilitychange` / `focus`).
  - [x] Déplacement de la fermeture du handle SQLite Web de `beforeunload` vers `pagehide` dans `src/database/db.ts` afin que le flush `beforeunload` de `cloudSyncService.ts` puisse lire SQLite sans erreur de base fermée.

---

## - [ ] Fiche 1.9 — Fichiers monolithiques ("God Files"), `catch {}` silencieux et absence de tests
- **Catégorie** : Architecture & Maintenabilité
- **Priorité** : 🟡 **Mineur (Optimisation)**
- **Actions correctives à cocher** :
  - [ ] Découper `src/app/(tabs)/index.tsx`, `history.tsx` et `settings.tsx` en sous-composants et hooks dédiés.
  - [ ] Scinder `cloudSyncService.ts` par domaine métier (`workoutSync`, `profileSync`, `socialSync`).
  - [ ] Configurer `vitest` ou `jest` et couvrir en priorité `gamificationService.ts`, `workoutSessionStore.ts` et `aiWorkoutService.ts`.

---

# PARTIE 2 — NIVEAU 2 : FONCTIONNEL, MÉTIER & UX/UI

---

## - [x] Fiche 2.1 — Incohérence des 3 formules de calcul d'XP (Séance active vs Store vs Écran Résumé) ✅ CORRIGÉ
- **Catégorie** : Logique Métier & Gamification
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives réalisées** :
  - [x] Centralisation du calcul d'XP dans `src/services/gamificationService.ts` via `calculateSessionXp`, `calculateSingleExerciseXp` et `calculateActiveExercisesXp` (prenant en compte `exercise_name`, `target_muscle` et `equipment_needed`).
  - [x] Utilisation de `calculateActiveExercisesXp` et `calculateSingleExerciseXp` dans `src/app/workout/active.tsx` et passage des séries détaillées (`sessionDetails?.sets || lastSession.sets`) à `calculateSessionXp` dans `src/app/workout/summary.tsx`.

---

## - [x] Fiche 2.2 — Trophées / Achievements dont la récompense `rewardXp` n'est jamais créditée ✅ CORRIGÉ
- **Catégorie** : Logique Métier & Gamification
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives réalisées** :
  - [x] Ajout de la somme des `rewardXp` des achievements débloqués (`achievementsXp`, jusqu'à +2 350 XP) dans le calcul de `totalXp` et `levelInfo` au sein de `getGamificationSnapshot` (`src/services/gamificationService.ts`).

---

## - [x] Fiche 2.3 — Défis entre amis (`friendChallengeService`) jamais validés automatiquement ✅ CORRIGÉ
- **Catégorie** : Logique Métier & Fonctionnalités Sociales
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives réalisées** :
  - [x] Création de `evaluateAndCompleteWorkoutChallenges` dans `src/services/multiplayer/friendChallengeService.ts` et appel automatique dans `finishWorkout` (`src/stores/workoutSessionStore.ts`) pour valider les défis d'exercice (poids max, répétitions max, volume) et de programme dès que la cible est atteinte.

---

## - [x] Fiche 2.4 — Réglage d'unité de poids (`KG` / `LBS`) inopérant sur les séances ✅ CORRIGÉ
- **Catégorie** : Cohérence Fonctionnelle & Parcours Utilisateur
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives réalisées** :
  - [x] Ajout des utilitaires `KG_TO_LBS_FACTOR`, `convertWeightFromKg` et `formatWeightWithUnit` dans `src/utils/exerciseUnits.ts` et conversion bidirectionnelle `kg <-> lbs` dans `src/components/workout/ExerciseSetRow.tsx`, `src/app/workout/summary.tsx`, `src/app/(tabs)/history.tsx` et `src/services/workoutSharingService.tsx`.

---

## - [x] Fiche 2.5 — Chronomètre de Course / Marche non persisté en cas de navigation ou mise en veille ✅ CORRIGÉ
- **Catégorie** : Parcours Utilisateur & Robustesse Fonctionnelle
- **Priorité** : 🟡 **Mineur (Optimisation)**
- **Actions correctives réalisées** :
  - [x] Persistance automatique de `isRunning`, `startTimestamp`, `accumulatedSeconds` et `activityType` dans `AsyncStorage` (`@vitax_active_running_timer`) dans `src/app/running/index.tsx` avec recalcul du temps écoulé au retour sur l'écran.

---

## - [x] Fiche 2.6 — Profils fictifs (`VITAX_COMMUNITY_ATHLETES`) indiscernables des vrais joueurs dans l'Arène ✅ CORRIGÉ
- **Catégorie** : UX / Transparence Produit & Parcours Social
- **Priorité** : 🟡 **Mineur (Optimisation)**
- **Actions correctives réalisées** :
  - [x] Ajout du champ `isBot?: boolean` sur `LeaderboardEntry` (`src/types/social.ts`) et affichage d'un badge explicite `🤖 Coach IA` à la place du bouton `+ Inviter` pour les profils bots communautaires dans `src/components/arena/tabs/LeaderboardTab.tsx`.

---

## - [ ] Fiche 2.7 — Ergonomie Web Desktop (plein écran non contenu) & Boutons de simulation visibles
- **Catégorie** : Design System, Responsive UI & Propreté Production
- **Priorité** : 🟡 **Mineur (Optimisation)**
- **Actions correctives à cocher** :
  - [ ] Encapsuler le layout Web Desktop dans un conteneur centré (`maxWidth: 480` ou grille responsive dédiée) dans `src/app/_layout.tsx`.
  - [x] Masquer `onSimulateGift` derrière `__DEV__` dans `LeaderboardTab.tsx`.

---

## - [x] Fiche 2.8 — Accessibilité WCAG (`user-scalable=no`), `Alert.alert` sur Web & Conformité RGPD (Droit à l'oubli Cloud) ✅ CORRIGÉ
- **Catégorie** : Accessibilité (WCAG / RGAA) & Conformité RGPD
- **Priorité** : 🟠 **Majeur (Impact fort)**
- **Actions correctives réalisées** :
  - [x] Retrait de `maximum-scale=1, user-scalable=no` dans `src/app/+html.tsx` pour respecter WCAG 1.4.4.
  - [x] Remplacement de tous les appels directs à `Alert.alert` par `showAlert` (`src/utils/alert.ts`) dans `src/app/workout/ai-generator.tsx`, `src/components/social/FriendInviteNotificationBanner.tsx` et `src/services/workoutSharingService.ts`.
  - [x] Ajout de `deleteTrainerAccountAndCloudData()` dans `src/services/authService.ts` et du bouton « Supprimer mon compte et mes données Cloud (RGPD) » dans `src/app/(tabs)/settings.tsx` permettant l'effacement complet de toutes les tables Supabase et du stockage local.
