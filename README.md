# 🏓 ft_transcendence

An interactive social network and modern web platform featuring real-time chat, advanced user management, and generative AI services.

---

## 👥 Team & Contributions

> *Section pending team review.*

| Member | Intra 42 | Role | Primary Contributions |
| :--- | :--- | :--- | :--- |
| **Member 1** | `igilbert` | *TBD* | *TBD* |
| **Member 2** | `jdupuis` | *TBD* | *TBD* |
| **Member 3** | `norabino` | *TBD* | *TBD* |
| **Member 4** | `tcarlier` | *TBD* | *TBD* |

---

## 🎯 Chosen Modules & Points Breakdown (Total: 16 / 14 pts)

### 🟢 Major Modules (5 x 2 = 10 pts)

* **Web Framework Frontend & Backend (2 pts)**
  * Combined usage of a modern Frontend framework (**React + Vite**) and a structured Backend framework (**NestJS**).
* **Real-Time Features via WebSockets (2 pts)**
  * Low-latency bidirectional communication (online/offline status, instant messaging) using WebSockets (Socket.IO / NestJS Gateways).
* **User Interactions (2 pts)**
  * Instant messaging system, public profile views, and friendship management.
* **User Management & Authentication (2 pts)**
  * Full profile management, custom avatar upload and update (with default fallback), and real-time presence tracking.
* **Complete LLM System Interface (2 pts)**
  * Generative AI integration featuring streaming text responses, fine-grained error handling, and rate limiting.

### 🟡 Minor Modules (3 x 1 = 3 pts)

* **ORM Usage (1 pt)**
  * **Prisma ORM** for schema modeling, database migrations, and type-safe queries.
* **Remote OAuth 2.0 Authentication (1 pt)**
  * Secure third-party authentication via the **42 API**.
* **Two-Factor Authentication / 2FA (1 pt)**
  * Account protection via TOTP (Time-based One-Time Password) authenticator apps.

### 🔵 Modules of Choice (3 pts)

* **[MAJOR] Infrastructure & Cloud VPS Hosting with Custom Domain (2 pts)**
  * **Justification:** The project is deployed and publicly accessible on a remote Virtual Private Server (VPS) configured with a custom domain name, HTTPS reverse proxy (Certbot / SSL), and automated CI/CD pipeline without requiring local repository cloning by evaluators.
* **[MINOR] Hybrid AI Architecture (Local Ollama + Cloud Gemini) (1 pt)**
  * **Justification:** Hybrid AI routing implementation combining a local model (Ollama) for fast/private execution and the Cloud Gemini API for complex tasks requiring larger context windows.

---

## 🛠️ Technical Choices Justification

### 🌐 Frontend: React + Vite
* **Why React?** Component-driven architecture simplifies UI reusability (modals, chat cards, post feeds) and enables reactive DOM state updates when handling WebSocket events.
* **Why Vite?** Instant development server startup (ultra-fast HMR) and optimized Rollup production builds, delivering superior performance compared to legacy tools.

### ⚙️ Backend: NestJS
* **Why NestJS?** Enterprise-grade TypeScript framework offering a strict modular architecture (*Controllers, Services, Gateways, Modules*) built on dependency injection. Native integration for WebSockets (`@WebSocketGateway`), JWT authentication guards, and Prisma ORM.

### 🗄️ Database & ORM: PostgreSQL + Prisma
* **Why PostgreSQL over MongoDB?**
  1. **Relational Data Integrity:** Relational schema with strict relationships (`User` $\leftrightarrow$ `Friendship`, `Channel` $\leftrightarrow$ `Message`, `Post` $\leftrightarrow$ `Like`). Guarantees native referential integrity using foreign keys and cascading deletions (`onDelete: Cascade`).
  2. **ACID Compliance & Security:** Authentication credentials, 2FA secrets, OAuth tokens, and username/email uniqueness require strict atomic guarantees.
* **Why Prisma?**
  * Auto-generated, 100% type-safe TypeScript client eliminating runtime SQL errors.
  * Declarative, readable schema definitions and migrations managed through `schema.prisma`.

---

## 🗃️ Database Schema (Prisma)

The application relies on the following data model:

```mermaid
erDiagram
    USER ||--o{ FRIENDSHIP : "requester / addressee"
    USER ||--o{ CHANNEL_MEMBER : "participates"
    USER ||--o{ MESSAGE : "sends"
    USER ||--o{ POST : "creates"
    USER ||--o{ LIKE : "gives"
    USER ||--o{ COMMENT : "writes"

    CHANNEL ||--o{ CHANNEL_MEMBER : "contains"
    CHANNEL ||--o{ MESSAGE : "stores"

    POST ||--o{ LIKE : "receives"
    POST ||--o{ COMMENT : "receives"