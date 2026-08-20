# MotsFléchés — Architecture & choix de design

> Document vivant : reflet des décisions d'architecture validées avec le porteur de projet.
> Les specs détaillés et plans d'implémentation vivent dans `docs/superpowers/`.

## Vue d'ensemble

**MotsFléchés** est une plateforme complète de mots fléchés : comptes utilisateurs,
progression, classements, grille du jour, et grilles curées à la main créées via un
éditeur visuel admin.

Le projet est découpé en **sous-projets** livrés séquentiellement, chacun avec sa
propre boucle *spec → plan → implémentation* :

| # | Sous-projet | Statut |
|---|---|---|
| 1 | Fondations — monorepo, squelette front/back, CI | En cours d'implémentation |
| 2 | Moteur de grille — modèle, rendu, saisie, validation | À définir |
| 3 | Backend de base — API, auth, CRUD grilles, publication | À définir |
| 4 | Éditeur admin — création/édition visuelle de grilles | À définir |
| 5 | Progression & classements — suivi, scores, classements | À définir |
| 6 | Grille du jour & engagement — daily puzzle, streak, PWA | À définir |

## Décisions de design validées

| Domaine | Décision | Justification |
|---|---|---|
| Portée | Plateforme complète | Comptes, progression, classements, grille du jour |
| Cibles | Web / PWA | Responsive, installable, offline |
| Grilles | Curées à la main | Qualité contrôlée ; éditeur visuel admin |
| Front | Angular 22 (scaffold initial) | Écosystème TypeScript, productivité |
| Back | NestJS + TypeScript | Même langage que le front, structure robuste pour API + auth |
| BDD | PostgreSQL + Prisma ORM | Relationnel, standard de l'écosystème NestJS |
| Monorepo | Nx | Orchestration centralisée, cache, génération de code |
| Tests | Vitest partout | Une seule config front + back |
| Git & CI | GitHub + GitHub Actions | Le plus courant, simple à mettre en place |
| Commits | Conventional Commits + commitlint + husky | Historique lisible et automatisé |
| Lint/format | ESLint (flat config) + Prettier | Conventions uniformes |

## Architecture cible

```
mots-fleches/                    (racine = monorepo Nx)
├── apps/
│   ├── web/                     → application Angular 22 (PWA)
│   └── api/                     → API REST NestJS
├── libs/
│   ├── shared/                  → types/contrats partagés front/back
│   └── (grille-engine, etc.)    → futurs moteurs réutilisables
├── docs/superpowers/
│   ├── specs/                   → specs de conception
│   └── plans/                   → plans d'implémentation
├── tools/                       → scripts internes
├── nx.json                      → config Nx
└── .github/workflows/ci.yml     → CI
```

- **Une seule source de contrats** : la lib `shared` héberge les DTOs/erreurs partagés
  entre front et back (pas de duplication de types).
- **Config par `.env`** : `.env` racine (non committé) + `.env.example` versionné.
  Prisma lit `DATABASE_URL` depuis le `.env` racine.
- **Vitest unifié** : front via `@angular/build:unit-test` (Vitest), back via
  `@nx/vitest:test`, une seule config de test.
- **Proxy de dev** : `apps/web/proxy.conf.json` route `/api/*` → `localhost:3000`
  pour éviter la CORS en dev.

## Conventions

- Branches : `main` protégée (PR obligatoire, checks verts) ; branches de travail `feat/...` / `fix/...`.
- Commits : Conventional Commits, hook `commit-msg` (commitlint) + `pre-commit` (lint-staged → Prettier).
- CI : sur chaque PR et push sur `main` → lint, test, build, format:check.
- Aucun secret dans le dépôt ; `.env` gitignoré.

## Cycle de vie d'un sous-projet

1. **Brainstorming** — questions de clarification, proposition d'approches, validation par sections.
2. **Spec** — `docs/superpowers/specs/YYYY-MM-DD-<sujet>-design.md`, relu et validé.
3. **Plan** — `docs/superpowers/plans/YYYY-MM-DD-<sujet>.md`, tâches exécutables.
4. **Implémentation** — subagents par tâche + revues (spec + qualité), revue finale globale.

## Etat actuel

- Sous-projet 1 (Fondations) : spec + plan rédigés et commités, implémentation en cours.
- Les sous-projets 2 à 6 : specs à brainstormer dans l'ordre du tableau ci-dessus.
  Le moteur de grille (2) est le prochain périmètre — il est concevable sans backend
  (grilles mockées) et servira de socle à l'éditeur admin et au backend.