# ParagonCrisis

Plateforme Next.js pour orchestrer des exercices de gestion de crise en temps réel. Le dépôt embarque déjà l'ossature frontend (App Router + TailwindCSS + DaisyUI), la configuration Prisma/SQLite et les squelettes backend (Socket.IO & scheduler) pour accélérer les itérations.

## 🚀 Démarrage rapide

```bash
pnpm install
pnpm prisma:migrate
pnpm prisma:generate
pnpm dev
```

> Par défaut, la base SQLite est stockée dans `prisma/dev.db`. Adaptez `DATABASE_URL` dans `.env` si vous changez d'environnement.

Après chaque modification du schéma Prisma, regénérez le client et exécutez la migration correspondante. Pour vérifier que les tables `Room`, `Participant`, `Message` et `CrisisEvent` ont bien été appliquées, vous pouvez lancer :

```bash
pnpm prisma migrate deploy
sqlite3 prisma/dev.db ".tables"
```

## 📁 Structure principale

- `src/app/(public)/page.tsx` – page d'accueil avec formulaires `formateur` & `participant`.
- `src/app/room/[code]/page.tsx` – maquette de salle de crise (chat, timeline, participants).
- `src/app/admin/page.tsx` – panneau formateur expérimental (injection & scénarios).
- `src/server/realtime/socket-server.ts` – squelette Socket.IO (à brancher sur le runtime Node).
- `src/server/scheduler/crisis-scheduler.ts` – scheduler d'événements probabilistes (15–30 s).
- `src/lib/prisma.ts` & `src/lib/env.ts` – helpers Prisma + validation des variables d'environnement.
- `prisma/schema.prisma` – modèle `Room`, `Participant`, `Message`, `CrisisEvent` + enums associés.

## 📦 Scripts utiles

- `pnpm dev` – lance Next.js en développement.
- `pnpm build` / `pnpm start` – build & exécution production.
- `pnpm lint` – lint via `next lint`.
- `pnpm prisma:migrate` – crée/applique une migration (`prisma/migrations`).
- `pnpm prisma:generate` – régénère le client Prisma dans `src/generated/prisma`.
- `pnpm prisma:studio` – ouvre Prisma Studio pour parcourir la base.
- `pnpm db:push` – pousse le schéma Prisma sans migration (en environnement jetable).

## 🔌 Intégrations temps réel & scheduler

- `/api/socket` instancie désormais automatiquement le serveur Socket.IO (voir `src/pages/api/socket.ts`). Un simple `curl http://localhost:3000/api/socket` suffit à l'amorcer en local si nécessaire.
- `RoomAccessForm` redirige vers `/room/{code}?name=...&admin=1` pour le formateur, `admin` absent pour participants.
- Le scheduler (`startRoomScheduler`) émet des événements fictifs via EventEmitter ; branchez-le au socket et persistez dans Prisma.
- Le panneau `/admin` permet de fermer une room active : l’action désactive la room, force la déconnexion des participants et coupe le scheduler associé.

## 🔐 Variables d'environnement

| Variable             | Description                                        |
|----------------------|----------------------------------------------------|
| `DATABASE_URL`       | Source de données Prisma (SQLite locale par défaut). |
| `ADMIN_SECRET`       | Clé attendue côté formateur pour autoriser les actions sensibles. |
| `NEXT_PUBLIC_WS_URL` | URL du serveur WebSocket côté client (optionnel). |

La validation est centralisée dans `src/lib/env.ts` (via Zod). Toute incohérence stoppe l'application au démarrage.

## 🛣️ Roadmap technique

- Brancher Socket.IO au backend Next.js (ou serveur Node dédié) et propager les événements `SYSTEM | CHAT | EVENT`.
- Connecter Prisma dans les routes API pour créer rooms, messages et événements, puis exposer un export JSON/CSV.
- Réaliser le composant audio (beep) côté client et gérer le throttling pour éviter les superpositions.
- Durcir l'accès admin (secret + audit des actions) et enrichir le panneau `/admin`.
- Écrire des tests E2E (Playwright) simulant un formateur + participant sur la même room.
