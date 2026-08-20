# Fondations — Monorepo, Squelette, CI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the standalone Angular scaffold into an Nx monorepo hosting the web app (Angular 22 PWA), the API (NestJS), and a shared types library, with uniform tooling, CI, and reproducible local dev.

**Architecture:** Nx monorepo with `apps/web` (Angular 22 PWA), `apps/api` (NestJS REST API), and `libs/shared` (shared contracts). Vitest for all unit tests, ESLint flat config per app, Prettier at root, Conventional Commits with husky/commitlint, GitHub Actions CI, Postgres via Docker Compose + Prisma init.

**Tech Stack:** Nx, Angular 22, NestJS, Prisma, PostgreSQL, Vitest, ESLint, Prettier, commitlint, husky, lint-staged, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-20-fondations-design.md`

## Global Constraints

- TypeScript partagé au niveau racine (6.0.2, déjà installé).
- Vitest partout (front + back) — une seule config de test.
- Aucun secret committé ; config via `.env` racine + `.env.example` versionné.
- `.gitignore` couvre `node_modules`, `dist`, `.env`, `.nx/cache`.
- Branches : `main` protégée (PR obligatoire + checks verts, à activer dans l'UI GitHub), branches de travail `feat/...` et `fix/...`.
- Commits : Conventional Commits (`feat:`, `fix:`, `chore:`, `ci:`, `docs:`, `refactor:`).
- Vérification finale : `npx nx run-many -t lint test build` passe de bout en bout.
- Tests front : le smoke test existant (`app.spec.ts`) passe après migration.
- Tests back : un test Vitest minimal vérifie que `GET /health` répond 200.

## File Structure

Avant les tâches, la cartographie des fichiers cibles :

```
apps/
├── web/                          # Angular 22 PWA (migré depuis la racine)
│   ├── src/                      # code Angular existant déplacé
│   ├── public/                   # favicon et assets (migrés)
│   ├── project.json              # config Nx du projet (remplace angular.json)
│   ├── proxy.conf.json           # proxy /api/* → localhost:3000
│   ├── ngsw-config.json          # config service worker PWA
│   └── tsconfig*.json            # configs TS du projet
├── api/                          # NestJS généré par @nx/nest
│   ├── src/
│   │   ├── main.ts               # bootstrap, port 3000
│   │   ├── app.module.ts         # module racine
│   │   ├── app.controller.ts     # GET /health → { status: 'ok' }
│   │   └── app.controller.spec.ts# test Vitest du controller
│   ├── prisma/schema.prisma      # schéma Prisma (datasource postgres, aucun modèle)
│   ├── vitest.config.ts          # config Vitest (environment node)
│   └── project.json              # config Nx du projet
libs/
└── shared/                       # lib TS (squelette vide, contrats futurs)
    ├── src/index.ts              # point d'export de la lib
    ├── vitest.config.ts          # config Vitest
    └── project.json              # config Nx du projet
docs/superpowers/
├── specs/2026-08-20-fondations-design.md   # spec (déjà committé)
└── plans/2026-08-20-fondations.md          # ce plan
.github/workflows/ci.yml          # CI GitHub Actions
docker-compose.yml                # service postgres local
.env.example                      # variables d'environnement (modèle)
.env                              # variables locales (non committé)
nx.json                           # config Nx
package.json                      # workspace racine (scripts orchestrés par Nx)
.prettierrc.json                  # config Prettier racine
.prettierignore
commitlint.config.mjs             # config commitlint
.husky/pre-commit                 # hook : lint-staged
.husky/commit-msg                 # hook : commitlint
```

---

### Task 1: Convert workspace to Nx monorepo

**Files:**
- Modify: `package.json`, `.gitignore`
- Create: `nx.json`, `apps/web/project.json`, `apps/web/tsconfig*.json`
- Move: `src/` → `apps/web/src/`, `public/` → `apps/web/public/`

**Interfaces:**
- Consumes: le scaffold Angular existant à la racine (projet `mots-fleches` dans `angular.json`).
- Produces: le projet Nx `web` (build + serve + test fonctionnels), config Nx à la racine.

- [ ] **Step 1: Run Nx init**

Exécuter à la racine :

```bash
npx nx@latest init --nx-cloud=false
```

Répondre aux éventuelles invites : décliner Nx Cloud, accepter les modifications de fichiers proposées par Nx.

Résultat attendu : `nx.json` créé, `package.json` contient `nx` et les scripts Nx, `.gitignore` contient `.nx/cache`, `node_modules` mis à jour.

- [ ] **Step 2: Move the Angular project into apps/web**

```bash
npx nx g @nx/angular:move --project=mots-fleches --destination=apps/web --newProjectName=web
```

Résultat attendu : `src/` et `public/` déplacés dans `apps/web/`, `project.json` créé pour `web`, `angular.json` racine supprimé (ou vidé), les références de chemins mises à jour. Si un flag du generator diffère, consulter `npx nx g @nx/angular:move --help` et adapter.

- [ ] **Step 3: Verify structure**

Vérifier :
- `apps/web/src/main.ts`, `apps/web/src/app/app.ts`, `apps/web/public/favicon.ico` existent
- `nx.json` existe à la racine
- `angular.json` racine n'existe plus

- [ ] **Step 4: Build the web app**

```bash
npx nx build web
```

Résultat attendu : SUCCESS (build de production Angular).

- [ ] **Step 5: Run the web smoke test**

```bash
npx nx test web
```

Résultat attendu : le test existant `app.spec.ts` passe (vérifie le rendu de `Hello, mots-fleches`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(nx): convert workspace to Nx monorepo with web app"
```

---

### Task 2: NestJS API app with health endpoint

**Files:**
- Create: `apps/api/**` (généré par `@nx/nest:app`), `apps/api/vitest.config.ts`, `apps/api/src/app.controller.spec.ts`
- Modify: `apps/api/src/app.controller.ts`, `apps/api/src/app.module.ts`, `apps/api/project.json`
- Delete: `apps/api/src/app.service.ts` (remplacé par un endpoint health minimal)

**Interfaces:**
- Consumes: le workspace Nx (Task 1), les deps `@prisma/client` (installées à la Task 5, non requises pour cette tâche).
- Produces: le projet Nx `api` avec `GET /health` → `{ status: 'ok' }`, target `test` Vitest fonctionnelle.

- [ ] **Step 1: Install the Nest plugin**

```bash
npm install -D @nx/nest
```

- [ ] **Step 2: Generate the NestJS app**

```bash
npx nx g @nx/nest:app api --unitTestRunner=vitest
```

Résultat attendu : `apps/api/` avec `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`, `project.json`, `tsconfig*.json`, et une config Vitest (`vitest.config.ts`). Si le generator ne gère pas `--unitTestRunner=vitest`, utiliser `--unitTestRunner=none` et créer manuellement `apps/api/vitest.config.ts` au Step 4.

- [ ] **Step 3: Replace the controller with a health endpoint**

Remplacer le contenu de `apps/api/src/app.controller.ts` :

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
```

Supprimer `apps/api/src/app.service.ts` et retirer son import/utilisation dans `apps/api/src/app.module.ts` (le module ne déclare que `AppController`).

- [ ] **Step 4: Configure Vitest (si nécessaire)**

Si `apps/api/vitest.config.ts` n'existe pas, le créer :

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
});
```

Si le generator a installé Jest, supprimer `jest.config.*` et `apps/api/tsconfig.spec.json` Jest, puis définir la target `test` de `apps/api/project.json` :

```json
"test": {
  "executor": "@nx/vite:test",
  "outputs": ["{workspaceRoot}/coverage/apps/api"]
}
```

Si `@nx/vite` n'est pas installé : `npm install -D @nx/vite`.

- [ ] **Step 5: Write the failing test**

Créer `apps/api/src/app.controller.spec.ts` :

```typescript
import { describe, expect, it } from 'vitest';
import { AppController } from './app.controller';

describe('AppController', () => {
  it('exposes a health endpoint', () => {
    const controller = new AppController();
    expect(controller.health()).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
npx nx test api
```

Résultat attendu : PASS (`AppController › exposes a health endpoint`).

- [ ] **Step 7: Build the api**

```bash
npx nx build api
```

Résultat attendu : SUCCESS.

- [ ] **Step 8: Serve and hit the health endpoint**

```bash
npx nx serve api
```

Dans une autre fenêtre :

```powershell
Invoke-WebRequest -Uri http://localhost:3000/health | Select-Object -ExpandProperty Content
```

Résultat attendu : `{"status":"ok"}` avec statut HTTP 200.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(api): add NestJS app with health endpoint and vitest setup"
```

---

### Task 3: Shared types library

**Files:**
- Create: `libs/shared/**` (généré par `@nx/js:lib`)

**Interfaces:**
- Consumes: le workspace Nx (Task 1).
- Produces: le projet Nx `shared` avec un test Vitest vert — squelette vide destiné aux contrats front/back futurs.

- [ ] **Step 1: Install the JS plugin**

```bash
npm install -D @nx/js
```

- [ ] **Step 2: Generate the library**

```bash
npx nx g @nx/js:lib shared --unitTestRunner=vitest
```

Résultat attendu : `libs/shared/` avec `src/index.ts`, `project.json`, `tsconfig*.json`, config Vitest, et un test d'exemple généré.

- [ ] **Step 3: Run the lib test**

```bash
npx nx test shared
```

Résultat attendu : PASS (le test d'exemple généré valide que la config Vitest de la lib fonctionne).

- [ ] **Step 4: Lint the lib**

```bash
npx nx lint shared
```

Résultat attendu : PASS (ou target `lint` inexistante à corriger via la Task 4).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(shared): add shared types library skeleton with vitest"
```

---

### Task 4: Tooling and conventions

**Files:**
- Create: `.prettierrc.json`, `.prettierignore`, `commitlint.config.mjs`, `.husky/pre-commit`, `.husky/commit-msg`, configs ESLint des projets (`eslint.config.ts` sous `apps/web/` et `apps/api/` ou à la racine selon ce que génère Nx)
- Modify: `package.json` (deps, scripts, config `lint-staged`)

**Interfaces:**
- Consumes: les projets `web`, `api`, `shared` (Tasks 1-3).
- Produces: targets `lint` fonctionnelles sur chaque projet, hooks git actifs (Prettier + commitlint), formatage uniforme.

- [ ] **Step 1: Create Prettier config**

Créer `.prettierrc.json` :

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all"
}
```

Créer `.prettierignore` :

```
node_modules
dist
.nx
coverage
```

- [ ] **Step 2: Set up ESLint on each project**

Installer les deps :

```bash
npm install -D eslint @eslint/js typescript-eslint
```

Puis pour chaque projet :

```bash
npx nx g @nx/eslint:configuration --project=web
npx nx g @nx/eslint:configuration --project=api
npx nx g @nx/eslint:configuration --project=shared
```

Résultat attendu : une config ESLint flat (`.mjs`, `.ts` ou `.js`) créée pour chaque projet, targets `lint` présentes dans les `project.json`.

- [ ] **Step 3: Verify lint passes**

```bash
npx nx run-many -t lint
```

Résultat attendu : SUCCESS sur `web`, `api`, `shared`.

- [ ] **Step 4: Set up commitlint and husky**

```bash
npm install -D @commitlint/cli @commitlint/config-conventional husky lint-staged
npx husky init
```

Créer `commitlint.config.mjs` :

```javascript
export default { extends: ['@commitlint/config-conventional'] };
```

Remplacer le contenu de `.husky/pre-commit` (créé par `husky init`) par :

```sh
npx lint-staged
```

Créer `.husky/commit-msg` :

```sh
npx --no -- commitlint --edit "$1"
```

- [ ] **Step 5: Configure lint-staged**

Ajouter dans `package.json` :

```json
"lint-staged": {
  "*.{ts,html,scss,json,md,yml,yaml}": "prettier --write"
}
```

- [ ] **Step 6: Verify Prettier formatting**

```bash
npx nx format:write
npx nx format:check
```

Résultat attendu : `format:check` passe (aucune différence).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(tooling): add eslint, prettier, commitlint, husky, lint-staged"
```

Note : ce commit doit déjà respecter la convention (message `chore(tooling):`), ce qui valide le hook `commit-msg`.

---

### Task 5: Local dev infrastructure

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env`, `apps/web/proxy.conf.json`, `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/**`
- Modify: `apps/web/project.json` (proxyConfig sur la target `serve`), `package.json` (script `db:migrate`)

**Interfaces:**
- Consumes: projets `web` (Task 1) et `api` (Task 2).
- Produces: Postgres local via Docker Compose, connexion Prisma vérifiée, proxy de dev `/api/*` → `localhost:3000`, fichier `.env` racine lu par Prisma.

- [ ] **Step 1: Create docker-compose.yml**

Créer `docker-compose.yml` :

```yaml
services:
  postgres:
    image: postgres:16
    container_name: mots-fleches-postgres
    environment:
      POSTGRES_USER: motsfleches
      POSTGRES_PASSWORD: motsfleches
      POSTGRES_DB: motsfleches
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

- [ ] **Step 2: Create env files**

Créer `.env.example` :

```
DATABASE_URL=postgresql://motsfleches:motsfleches@localhost:5432/motsfleches
API_PORT=3000
WEB_PORT=4200
```

Copier vers `.env` :

```powershell
Copy-Item .env.example .env
```

Vérifier que `.gitignore` contient `.env` (l'ajouter si besoin : ligne `/.env`).

- [ ] **Step 3: Start Postgres**

```bash
docker compose up -d postgres
```

Vérifier :

```bash
docker compose ps
```

Résultat attendu : le service `postgres` est `running`.

- [ ] **Step 4: Install and init Prisma**

```bash
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql --schema apps/api/prisma/schema.prisma
```

Résultat attendu : `apps/api/prisma/schema.prisma` créé avec `generator client` et `datasource db` dont l'URL est `env("DATABASE_URL")`. Aucun modèle à cette étape.

Ajouter dans `package.json` le script :

```json
"db:migrate": "prisma migrate dev --schema apps/api/prisma/schema.prisma"
```

- [ ] **Step 5: Create the empty initial migration**

```bash
npx prisma migrate dev --name init --schema apps/api/prisma/schema.prisma
```

Résultat attendu : migration initiale créée dans `apps/api/prisma/migrations/` et appliquée à Postgres.

- [ ] **Step 6: Add the dev proxy**

Créer `apps/web/proxy.conf.json` :

```json
{
  "/api": {
    "target": "http://localhost:3000",
    "secure": false
  }
}
```

Dans `apps/web/project.json`, sur la target `serve`, ajouter l'option :

```json
"options": {
  "proxyConfig": "apps/web/proxy.conf.json"
}
```

- [ ] **Step 7: Verify the full dev loop**

```bash
npx nx serve api
```

Dans une autre fenêtre :

```powershell
Invoke-WebRequest -Uri http://localhost:3000/health | Select-Object -ExpandProperty Content
```

Résultat attendu : `{"status":"ok"}`.

Vérifier aussi que `npx nx serve web` démarre sur :4200 et que le proxy est actif (le dev server n'affiche aucune erreur de proxy au démarrage).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore(infra): add postgres compose, prisma init, dev proxy, env files"
```

Note : `.env` est gitignoré et ne doit PAS apparaître dans le commit. Vérifier avec `git status` avant de committer.

---

### Task 6: PWA setup

**Files:**
- Create: `apps/web/ngsw-config.json`, `apps/web/public/manifest.webmanifest`, `apps/web/public/icons/**` (générés par le schematic)
- Modify: `apps/web/src/main.ts` (enregistrement du service worker), `apps/web/src/index.html` (meta manifest + thème), `apps/web/project.json` (options de build : `serviceWorker`)

**Interfaces:**
- Consumes: projet `web` (Task 1), Angular CLI schematic `@angular/pwa`.
- Produces: build de production avec service worker (`ngsw.json`) et manifest PWA (`manifest.webmanifest`) dans le dist.

- [ ] **Step 1: Install the PWA dependencies**

```bash
npm install @angular/service-worker
npm install -D @angular/pwa
```

- [ ] **Step 2: Run the PWA schematic**

```bash
npx nx g @angular/pwa:ng-add --project=web
```

Si la commande échoue (collection introuvable), fallback Angular CLI :

```bash
npx ng add @angular/pwa --project=web --skip-confirmation
```

Résultat attendu : `apps/web/ngsw-config.json` créé, `manifest.webmanifest` + icônes dans `apps/web/public/`, `main.ts` enregistre le service worker, `index.html` référence le manifest, le build target active `serviceWorker`.

- [ ] **Step 3: Verify the PWA build**

```bash
npx nx build web
```

Résultat attendu : SUCCESS. Vérifier que `dist/apps/web/browser/ngsw.json` et `dist/apps/web/browser/manifest.webmanifest` existent.

- [ ] **Step 4: Run the web tests (regression)**

```bash
npx nx test web
```

Résultat attendu : le smoke test passe toujours.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(web): enable PWA with manifest and service worker"
```

---

### Task 7: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: tous les projets (`web`, `api`, `shared`) et les conventions de la Task 4.
- Produces: pipeline CI verte sur chaque PR et push sur `main` (lint, test, build, format:check).

- [ ] **Step 1: Create the workflow file**

Créer `.github/workflows/ci.yml` :

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npx nx run-many -t lint
      - name: Test
        run: npx nx run-many -t test
      - name: Build
        run: npx nx run-many -t build
      - name: Format check
        run: npx nx format:check
```

- [ ] **Step 2: Validate the workflow file**

Le fichier YAML doit être valide. Valider la syntaxe via Prettier :

```bash
npx prettier --check .github/workflows/ci.yml
```

Résultat attendu : pas de différence de format.

- [ ] **Step 3: Run the full verification gate**

```bash
npx nx run-many -t lint
npx nx run-many -t test
npx nx run-many -t build
npx nx format:check
```

Résultat attendu : les quatre commandes passent de bout en bout.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: add GitHub Actions workflow for lint, test, build, format"
```

- [ ] **Step 5: (Manuel, hors code) Protection de main**

Dans l'UI GitHub : activer la protection de branche sur `main` (exiger une PR, exiger les checks verts `checks`). À faire par l'utilisateur lors du premier push vers GitHub.

---

## Critères de fin

Après la Task 7 :

- `npx nx run-many -t lint test build` passe de bout en bout.
- `npx nx format:check` passe.
- `npx nx serve api` démarre et `GET /health` répond `{"status":"ok"}` (200).
- `npx nx serve web` démarre sur :4200 avec le service worker PWA actif.
- Le dépôt ne contient aucun secret ; `.env` est gitignoré.