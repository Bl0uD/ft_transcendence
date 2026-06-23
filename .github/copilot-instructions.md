# Context & Rules for ft_transcendence ( Collaborative App)

You are an expert software architect and senior full-stack TypeScript developer helping our team build "ft_transcendence", the final core project at School 42. We chose : A real-time collaborative platform / social network with local AI integration.

## 🛠️ Tech Stack & Infrastructure
- **Architecture:** Modular Monolith in a mono-repo structure.
- **Frontend:** React (SPA) powered by **Vite**, styled with **Tailwind CSS** (and Shadcn/ui).
- **Backend:** **NestJS (TypeScript)** using strict object-oriented paradigms, dependency injection, and modular architecture.
- **Containers (5):**
  1. `gateway`: Caddy (Handles HTTPS automatically, routes `/` to frontend static files, `/api` and `/ws` to NestJS).
  2. `frontend`: Vite dev server (dev) or compiled static assets (prod).
  3. `backend`: NestJS application (REST API + WebSockets via NestJS Gateways).
  4. `database`: PostgreSQL (Isolated in the backend network, managed via Prisma or TypeORM).
  5. `ai`: Ollama running locally (handling LLM requests offline).

## 🟥 Hard Constraints (School 42 Rules)
- **HTTPS Everywhere:** All external traffic to NestJS or React MUST go through Caddy using HTTPS/WSS.
- **Strict Input Validation:** Every incoming request to NestJS MUST be validated using `class-validator` and `ValidationPipe` via DTOs (Data Transfer Objects). Frontend must duplicate this validation before submission.
- **Security First:** Protect against SQL Injections (use ORM features safely), XSS, and CSRF. Passwords must be strictly hashed and salted (e.g., argon2 or bcrypt).
- **Multi-user Support:** Handle concurrency and race conditions. Clean up WebSockets properly in NestJS Gateways (`handleDisconnect`) to prevent memory leaks.
- **Legal Compliance:** Accessible "Privacy Policy" and "Terms of Service" pages linked in the Tailwind footer. No placeholder text allowed.

## 🎯 Target Modules & NestJS/React Implementations (14 Points)
1. **Web (6 pts):** - Framework Front & Back (2pts) -> NestJS + React.
   - WebSockets (2pts) -> NestJS `@WebSocketGateway()` and Socket.io/ws client.
   - User Interaction/Chat/Friends (2pts) -> NestJS ChatModule, messages persisted in Postgres.
2. **User Management (4 pts):** - Standard User Management (2pts) -> Profiles, avatar uploads with size validation.
   - Advanced Permissions/RBAC Roles (2pts) -> Handled via NestJS `Guards` and `@Roles()` decorators (Admin, Moderator, User).
3. **Artificial Intelligence (2 pts):** Local LLM interface via Ollama (2pts) calling the local container endpoint from NestJS.
4. **Web (2 pts):** Secured Public API with Key, NestJS Throttler for Rate-limiting, and Swagger documentation (2pts).

## 💻 Coding Guidelines & Architecture Patterns

### Backend (NestJS)
- Follow the official NestJS layout: `Module` -> `Controller`/`Gateway` -> `Service` -> `Repository`/`Entity`.
- Use DTOs for *everything* that comes from the client. Never trust raw JSON.
- Leverage NestJS `Guards` for Auth and RBAC, and `Interceptors` for formatting responses.
- Keep the business logic strictly inside Services, never in Controllers or Gateways.

### Frontend (React & Tailwind)
- Use functional components with hooks. Prefer standard TypeScript (`.tsx`).
- Separate state: Use **React Query / SWR** for server-state caching (API fetches) and **Zustand** or clean React Context for pure local UI state.
- Tailwind utility classes must be organized logically (prefer using `prettier-plugin-tailwindcss` layout order).
- Build modular, reusable Tailwind components (buttons, inputs, modals) to keep the codebase DRY.

### Error Handling
- Backend must catch all database/system errors and throw standard `HttpException` or `WsException`.
- Frontend must handle these errors gracefully without crashing or showing blank pages.