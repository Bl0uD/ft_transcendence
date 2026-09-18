# ft_transcendence

ft_transcendence is a real-time social platform built for the 42 project. It combines a social feed, user profiles, social relationships, Socket.IO messaging, and a hybrid AI assistant.

The backend is a **NestJS modular monolith**. Docker orchestrates the runtime components around this backend: a Vite frontend, PostgreSQL, Caddy, and Ollama. This is not an application microservices architecture.

## Features

### Authentication and security

* Account registration and login with an email or username and a bcrypt-hashed password.
* OAuth2 login through the 42 API.
* JWT sessions with optional TOTP 2FA protected by a QR code setup flow.
* DTO validation with `class-validator`, a global `ValidationPipe`, and rejection of unknown properties.
* Message sanitization with `sanitize-html` and length limits.
* Routes and conversations protected by JWT, 2FA, and blocking relationships.

### Social network

* Public profiles with usernames, nicknames, and avatars.
* A social feed with text posts, images, likes, comments, and public or friends-only visibility.
* Friend requests, acceptance, removal, and a list of pending requests.
* User blocking and unblocking, with blocked posts and conversations filtered accordingly.

### Real-time messaging

* Socket.IO messaging with JWT authentication during the socket connection.
* Public, private, protected, and direct one-to-one channels.
* Message history persisted in PostgreSQL.
* New-message notifications and channel updates through Socket.IO rooms.
* Online/offline presence for friends and connection cleanup on disconnect.

### Hybrid AI assistant

* **Ollama / Llama 3**, running locally in the `ai` container, to classify requests and trigger social or navigation actions.
* **Google Gemini**, optional and enabled with `GEMINI_API_KEY`, for general conversations.
* SSE responses streamed progressively to the frontend.
* Separate AI conversations with messages persisted in PostgreSQL.
* Dedicated limits: 10 requests per minute for Ollama and 5 for Gemini.

## Architecture and technologies

* **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Zustand, and Axios.
* **Backend:** NestJS 11, TypeScript, Prisma, PostgreSQL, Socket.IO, Passport, bcrypt, and Multer.
* **Local AI:** Ollama with the Llama 3 model. NVIDIA and AMD GPU configurations are available through dedicated Compose files.
* **Reverse proxy:** Caddy terminates HTTPS on `https://localhost` and routes `/api`, `/auth`, `/socket.io`, and `/ws` to the appropriate services.
* **Docker networks:** the frontend and backend share the frontend network; PostgreSQL and Ollama remain on the backend network.

## Installation

### Prerequisites

* Docker and Docker Compose.
* 42 API application credentials if OAuth2 login is required.
* A root `.env` file. `backend/.env.exemple` lists the minimum backend variables; Compose also uses PostgreSQL and infrastructure variables.

### Configuration

Create a root `.env` file containing at least:

```env
POSTGRES_USER=transcendence_user
POSTGRES_PASSWORD=transcendence_password
POSTGRES_DB=transcendence_db
DATABASE_URL=postgresql://transcendence_user:transcendence_password@database:5432/transcendence_db?schema=public

JWT_SECRET=change_me_with_a_long_random_secret
BACKEND_PORT=3000
OLLAMA_HOST=http://ai:11434
NODE_ENV=development
VITE_API_URL=/api

FORTYTWO_APP_ID=
FORTYTWO_APP_SECRET=
FORTYTWO_CALLBACK_URL=https://localhost/auth/42/callback
FRONTEND_URL=https://localhost

# Optional: enables the Gemini provider
GEMINI_API_KEY=
```

Never commit secrets. The OAuth2 callback URL must match the URL registered in the 42 application.

### Launch

From the repository root:

```bash
make up
```

Or directly:

```bash
docker compose up --build -d
```

The application is then available at **https://localhost**. Caddy uses a local certificate, so the browser may ask for confirmation on the first visit.

The first startup may take some time because the Ollama container downloads the Llama 3 model. Before starting in development mode, the backend synchronizes the Prisma schema with PostgreSQL using `prisma db push`.

Useful commands:

```bash
make ps
make logs
make down
make prisma-push
make fclean
```

`make fclean` also removes the PostgreSQL and Ollama volumes.

## Repository structure

```text
.
├── ai/                # Ollama initialization and Llama 3 download
├── backend/           # NestJS modular monolith and Prisma schema
│   ├── src/auth/      # Local authentication, 42 OAuth2, and 2FA
│   ├── src/chat/      # Socket.IO controller, service, and gateway
│   ├── src/friends/   # Social relationships and presence
│   ├── src/posts/     # Posts, likes, and comments
│   ├── src/ai/        # Ollama and Gemini SSE routes
│   └── prisma/        # Schema and migrations
├── frontend/          # React/Vite SPA
├── caddy/             # HTTPS and WebSocket routing
├── docker-compose.yml # Docker services and networks
└── Makefile           # Local operations commands
```

## Project status

The repository is under development. Remaining improvements are tracked in [TO_DO.txt](TO_DO.txt), including channel notifications and enhancements to the AI assistant interface.
