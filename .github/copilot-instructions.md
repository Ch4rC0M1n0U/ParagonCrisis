# ParagonCrisis · Guide pour agents IA

## Vue d'ensemble du dépôt
- Dépôt initial quasi vierge : seul `README.md` est présent. Toute nouvelle fonctionnalité doit commencer par mettre en place l'ossature Next.js 14 (App Router) en TypeScript.
- Cahier des charges fourni : simulateur de crise en temps réel pour formateurs et participants avec rooms, chat, événements aléatoires et signaux audio.

## Architecture cible à structurer
- **Frontend** : Next.js + TailwindCSS + DaisyUI (mentionné dans le brief). Prévoir des pages `app/(public)/` pour l'accueil et `app/room/[code]/` pour les salles.
- **Backend temps réel** : WebSocket (Socket.IO ou ws). Chaque room doit avoir un canal dédié pour messages `SYSTEM | CHAT | EVENT` et synchronisation audio.
- **Scheduler** : générateur d'événements probabilistes par room (toutes les 15–30 s). Encapsuler la logique côté serveur (cron en mémoire ou worker dédié) pour éviter le code côté client.
- **Persistance** : Prisma + SQLite. Tables attendues : `Room`, `Participant`, `Message`, `CrisisEvent`. Conserver les relations (Room 1-N Participant/Message/Event).
- **Containerisation** : prévoir un `Dockerfile` multi-stage (builder + runtime minimal) comme annoncé.

## Flux de travail recommandés
1. Scaffold : `pnpm create next-app@latest` (avec TypeScript, App Router, Tailwind). Ajouter DaisyUI via `pnpm add daisyui` et extension dans `tailwind.config.ts`.
2. Base données : `pnpm add prisma @prisma/client`. Initialiser `npx prisma init --datasource-provider sqlite`. Placer `DATABASE_URL="file:./prisma/dev.db"` dans `.env`.
3. Modélisation : définir le schéma Prisma (tables ci-dessus + enums `MessageType`). Exécuter `pnpm prisma migrate dev --name init`.
4. Temps réel : créer un serveur WebSocket partagé (ex. `/app/api/socket/route.ts`). En Next.js App Router, utiliser `NextServer` + Socket.IO adapter ou un server Edge-compatible si nécessaire.
5. Lancement : `pnpm dev` pour Next.js. Ajouter un script `pnpm prisma studio` pour inspection rapide.
6. Tests : mettre en place Vitest/Playwright selon la surface (non présent actuellement). Documenter commandes une fois créées.
7. Docker : garder en tête un stage `builder` (install + build) puis un stage `runner` (Next.js standalone + prisma generate).

## Conventions fonctionnelles
- Les URLs de rooms suivent `/room/[CODE]?name=Participant`. Le formateur ajoute `&admin=1`.
- Un `ADMIN_SECRET` est exigé côté client pour accéder aux actions d'injection sur `/admin`. Stocker dans `.env` et ne jamais exposer en clair dans le code.
- Les événements `EVENT` déclenchent un beep audio côté client ; conserver un composant audio dédié dans l'arbre React pour éviter les recharges multiples.
- Les événements auto-générés doivent inclure un champ `severity` (anticiper filtrage futur) et horodatage précis (`createdAt` avec millisecondes).
- Prévoir une séparation UI : composants `AdminSidebar`, `Timeline`, `RoomChat`, `EventComposer` pour clarifier responsabilités.

## Points d'attention
- Le projet vise des simulations stressantes : gérer la temporisation des beeps pour éviter le chevauchement audio.
- Préparer dès maintenant l'export (CSV/JSON) en exposant une API de récupération des messages triés par `createdAt`.
- Noter les évolutions futures : scénarios planifiés, TTS "101", scoring temps de réaction. Structurer le code pour permettre ces hooks (ex. services `scenarioEngine`, `callSimulator`).
- Documenter dans `README.md` les commandes réellement disponibles dès qu'elles sont ajoutées pour garder les agents synchronisés.

## Variables d'environnement attendues
- `DATABASE_URL` : chemin SQLite ou connexion Postgres future.
- `ADMIN_SECRET` : clé d'accès admin.
- `NEXT_PUBLIC_WS_URL` : URL WebSocket pour clients (utile si reverse proxy).

## Validation / QA
- Après migrations : `sqlite3 prisma/dev.db ".tables"` pour vérifier la création locale.
- Couvrir au moins un test e2e simulant un participant et un formateur se connectant à la même room.
- Utiliser `pnpm lint` et `pnpm test` lorsqu'ils seront mis en place ; mentionnez les sorties dans les PR.

## Documentation vivante
- Mettre à jour ce fichier à chaque ajout majeur (schéma Prisma, workflows de build/test, endpoints). Mentionner la date et la section modifiée.
