# Matcha — stack

Node (Express + TypeScript) · PostgreSQL · Socket.io · React (Vite)

## Pourquoi cette stack

| Choix | Raison |
|---|---|
| **Express** | Micro-framework autorisé (router seul), un seul langage avec le front |
| **PostgreSQL** | SQL manuel, géo (lat/lng + distance), tags, likes, chat — le plus simple et solide |
| **Socket.io** | Chat + notifs temps réel (< 10s) sans complexifier |
| **React + Vite** | UI autorisée, composants clairs pour profil / recherche / chat |
| **Docker Compose** | Postgres + Mailhog (emails locaux) en une commande |
| **Sessions cookie** | Plus simple et plus sûr que JWT pour une web app classique |
| **bcrypt + SQL paramétré** | Exigences sécu obligatoires |

Pas d’ORM (interdit). Pas de Nest/Next full-stack (trop lourd pour le sujet).

## Démarrage

```bash
cp .env.example .env
docker compose up -d
cd server && npm i && npm run db:migrate && npm run dev
cd client && npm i && npm run dev
```

- App : http://localhost:5173  
- API : http://localhost:3000  
- Mailhog : http://localhost:8025  

## Architecture

```
matcha/
├── docker-compose.yml      # postgres + mailhog
├── .env.example
├── server/                 # API Express + Socket.io
│   └── src/
│       ├── index.ts
│       ├── config/
│       ├── db/             # pool + schema.sql + requêtes SQL
│       ├── middleware/     # auth, validation, upload
│       ├── routes/         # auth, profile, browse, search, chat…
│       ├── services/       # email, fame, matching, geo
│       ├── sockets/        # chat + notifications
│       └── utils/
└── client/                 # React SPA
    └── src/
        ├── pages/
        ├── components/
        ├── hooks/          # socket, auth
        └── api/
```

## Domaine (obligatoire)

1. **Auth** — inscription, vérif email, login, reset MDP, logout
2. **Profil** — genre, orientation, bio, tags, 5 photos, localisation, fame
3. **Browse / Search** — suggestions + recherche avancée (âge, fame, dist, tags)
4. **Social** — like / unlike / match / block / report / vues
5. **Chat** — messages temps réel entre matchs
6. **Notifications** — like, vue, message, match, unlike (temps réel)

## Bonus

1. **OAuth** — 42 / GitHub / Google (boutons visibles seulement si les secrets sont dans `.env`)
2. **Galerie** — drag-and-drop, réordonnancement, crop/rotation/filtres avant upload
3. **Carte** — `/map` (Leaflet + OSM) et GPS `watchPosition` haute précision
4. **Visio / audio** — WebRTC entre matchs (STUN Google)
5. **Rendez-vous** — propositions IRL depuis le chat, suivi sur `/dates`

