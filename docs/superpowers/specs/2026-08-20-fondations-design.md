# MotsFléchés — Fondations : Monorepo, Squelette, CI

Date : 2026-08-20

## Contexte

L'application **MotsFléchés** est une plateforme complète de mots fléchés :
comptes utilisateurs, progression, classements, grilles du jour, grilles
curées à la main créées via un éditeur visuel admin.

C'est le premier sous-projet d'un découpage plus large :

1. **Fondations** (ce spec) — monorepo, squelette front/back, CI, conventions
2. Moteur de grille — modèle de données, rendu, saisie, validation
3. Backend de base — API NestJS + Prisma, auth, CRUD grilles, publication
4. Éditeur admin — outil visuel de création/édition de grilles
5. Progression & classements — suivi de partie, scores, classements
6. Grille du jour & engagement — daily puzzle, streak, notifications PWA

Chaque sous-projet suit sa propre boucle spec → plan → implémentation.

## Objectif

Poser les fondations techniques du projet : un monorepo Nx hébergeant
l'application Angular et l'API NestJS, avec des conventions uniformes
(formatage, lint, tests, commits), une CI verte sur GitHub Actions, et un
démarrage local reproductible (Postgres via Docker, proxy de dev).

## Stack retenue

- Front : **Angular 22** (déjà scaffoldé), PWA
- Back : **NestJS + TypeScript**
- BDD : **Postgres** + **Prisma** ORM
- Monorepo : **Nx**
- Tests : **Vitest partout** (front + back)
- Git & CI : **GitHub** + **GitHub Actions**
- Lint/format : ESLint (flat config) + Prettier
- Commits : Conventional Commits via commitlint, lint-staged

## Architecture

### Structure du monorepo

```
mots-fleches/                    (racine = monorepo Nx, initialisé en git)
├── apps/
│   ├── web/                     → application Angular 22 (PWA)
│   └── api/                     → application NestJS (API REST)
├── libs/
│   ├── shared/                  → types/contrats partagés front/back (DTOs grille, erreurs)
│   └── (plus tard : grille-engine, etc.)
├── tools/                       → scripts internes (génération, publication)
├── nx.json                      → config Nx
├── package.json                 → workspace racine (workspaces + scripts orchestrés par Nx)
└── .github/workflows/ci.yml     → CI
```

Le scaffold Angular actuel (`src/`) migre vers `apps/web/src/`. La lib
`shared` héberge les types de contrat de la grille : point d'ancrage pour
que front et back parlent le même langage.

### Décisions de conception

- **Une seule version TypeScript** (6.0.2, déjà présente) partagée au niveau racine.
- **Config centralisée** : fichier `.env` à la racine (port API, URL Postgres, secrets), `.env.example` versionné, aucun secret committé.
- **Vitest partout** : une seule config de test pour front et back.
- **PWA** : activation via le schematic `@angular/pwa` dès les fondations (manifest, service worker, installabilité). Pas de fonctionnalités avancées (notifications) pour l'instant.

## Composants

### apps/web

Application Angular 22 migrée depuis la racine. Proxy de dev `/api/*` →
`localhost:3000` via `apps/web/proxy.conf.json` pour éviter la CORS en dev.
PWA activée. Routes vides pour l'instant (le contenu arrive au sous-projet 2).

### apps/api

Application NestJS créée via `@nx/nest`. Squelette minimal : module `App`,
health check basique (`GET /health`), connexion Prisma initiale.
Aucun modèle métier pour l'instant — uniquement le conteneur Postgres
(Docker Compose) et la connexion Prisma vérifiée.

### libs/shared

Bibliothèque TypeScript vide destinée aux DTOs/contrats partagés.
Aucun contenu au sous-projet 1, juste le squelette de la lib et sa config
(lint, test, build).

## Flux de données

Aucun flux de données métier au sous-projet 1. Le seul flux vérifié est :
`GET /health` du back répond 200, et le front charge dans le navigateur.

## Gestion d'erreurs

Hors périmètre du sous-projet 1. La gestion d'erreurs métier sera traitée
dans le sous-projet 2 (moteur de grille) et 3 (backend).

## Tests

- **Front** : le test de smoke `app.spec.ts` existant passe après migration.
- **Back** : un test Vitest minimal vérifie que `GET /health` répond 200.
- **Commande de vérification** : `nx run-many -t lint test build` doit passer de bout en bout.

## CI

Un workflow `ci.yml` sur chaque PR et push sur `main` :

1. `nx affected lint`
2. `nx affected test`
3. `nx affected build`
4. `nx format:check`

Le déploiement est hors périmètre (traité au sous-projet 3). La CI s'arrête
aux checks verts.

## Démarrage local

- `nx serve web` → Angular sur :4200
- `nx serve api` → NestJS watch mode sur :3000
- `nx run-many -t serve` → les deux en parallèle
- `docker-compose up -d postgres` → base locale
- `npx prisma migrate dev` → applique le schéma (vide pour l'instant)

## Conventions

- Prettier configuré au niveau racine ; `nx format:check` dans la CI.
- ESLint flat config par app.
- Conventional Commits (`feat:`, `fix:`, `chore:`...) via commitlint.
- lint-staged pour auto-formater avant commit.
- Branches : `main` protégée (PR obligatoire, checks verts requis),
  branches de travail `feat/...` / `fix/...`.

## Non-Objectifs

- Aucun modèle métier (grille, utilisateur, progression).
- Aucune feature de gameplay.
- Aucune auth.
- Aucun déploiement en production.
- Aucune UI au-delà de la page par défaut Angular fonctionnelle.

## Critères de réussite

- `nx run-many -t lint test build` passe de bout en bout.
- `nx serve web` et `nx serve api` démarrent ; `GET /health` répond 200.
- La CI GitHub Actions est verte sur un PR de fondations.
- Le front charge dans le navigateur avec le service worker PWA actif.