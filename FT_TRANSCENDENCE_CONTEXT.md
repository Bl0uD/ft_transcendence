# FT_TRANSCENDENCE — PROJECT CONTEXT

## Project Goal

Build a full-stack web application around a real-time Pong game.

The project must include:
- authentication,
- user management,
- multiplayer Pong,
- real-time communication,
- database persistence,
- secure backend architecture,
- Dockerized infrastructure.

The project is developed for the 42 school final web project:
ft_transcendence.

---

# GLOBAL ARCHITECTURE

The project is separated into independent domains.

```txt
Frontend
    ↓
REST API + WebSocket Gateway
    ↓
Backend Services
    ↓
Database
```

The backend is the source of truth.

The frontend NEVER decides:
- scores,
- collisions,
- game state,
- authentication validity.

The backend is authoritative.

---

# TECHNICAL PHILOSOPHY

Main principles:
- modular architecture,
- separation of concerns,
- stateless HTTP API,
- real-time communication through WebSocket,
- server-authoritative game loop,
- clean code before optimization,
- security first.

The project must remain maintainable and scalable.

---

# PROJECT MODULES

## 1. AUTH MODULE

Responsibilities:
- login
- registration
- JWT/session management
- 2FA
- OAuth if enabled
- secure cookies/tokens

Rules:
- passwords must be hashed
- frontend never stores sensitive secrets insecurely
- backend validates every protected request

Important:
Authentication logic must remain isolated from game logic.

---

## 2. USER MODULE

Responsibilities:
- profiles
- avatars
- match history
- leaderboard
- online status
- statistics

Rules:
- user data validation everywhere
- database consistency
- proper relationship handling

---

## 3. FRIENDS / SOCIAL MODULE

Responsibilities:
- friend requests
- blocked users
- invitations
- online presence

Rules:
- prevent duplicate relationships
- handle disconnected users correctly

---

## 4. CHAT MODULE

Responsibilities:
- real-time chat
- channels
- direct messages
- mute/ban/admin features if implemented

Architecture:
Chat events are separated from game events.

WebSocket transports messages only.
Business logic stays in services.

---

## 5. GAME MODULE

Responsibilities:
- Pong game logic
- matchmaking
- tournaments
- game state management

IMPORTANT:
The game engine must be independent from:
- rendering
- WebSocket transport
- UI

Recommended architecture:

```txt
Game Engine
    ↓
Game State
    ↓
Network Layer
    ↓
Frontend Renderer
```

---

# GAME ARCHITECTURE

## SERVER AUTHORITATIVE MODEL

The backend controls:
- ball movement
- collisions
- score
- game rules
- winner

The client only:
- sends inputs
- renders state

Never trust client-side physics.

---

## GAME LOOP

Recommended:
- fixed tickrate
- deterministic updates

Example:
```txt
60 ticks / second
```

Each tick:
1. receive player inputs
2. update physics
3. detect collisions
4. update score
5. broadcast new state

---

## WEBSOCKET ARCHITECTURE

Separate event types clearly.

Example:

```txt
SYSTEM EVENTS
- USER_ONLINE
- USER_OFFLINE

CHAT EVENTS
- CHAT_MESSAGE
- CHANNEL_JOIN

GAME EVENTS
- GAME_START
- PADDLE_MOVE
- SCORE_UPDATE
- GAME_END
```

Rules:
- no giant websocket handler
- route events by domain
- validate all payloads

---

# FRONTEND ARCHITECTURE

Frontend responsibilities:
- rendering UI
- navigation
- state management
- websocket client
- game rendering

Frontend should NOT:
- contain backend business logic
- decide game results
- bypass API validation

Recommended structure:

```txt
frontend/
│
├── core/
│   ├── api/
│   ├── auth/
│   ├── websocket/
│   ├── router/
│   └── store/
│
├── pages/
│   ├── login/
│   ├── dashboard/
│   ├── profile/
│   ├── game/
│   └── chat/
│
├── components/
│
├── game/
│   ├── renderer/
│   ├── networking/
│   ├── input/
│   └── state/
│
└── styles/
```

---

# BACKEND ARCHITECTURE

Recommended structure:

```txt
backend/
│
├── auth/
├── users/
├── friends/
├── chat/
├── game/
├── matchmaking/
├── websocket/
├── database/
├── security/
└── shared/
```

Each module should contain:
- routes/controllers
- services
- validation
- database access
- DTO/schema definitions

---

# DATABASE DESIGN

Main entities:

```txt
User
Match
Friendship
Message
Tournament
GameStats
Session
```

Rules:
- timestamps everywhere
- avoid nullable chaos
- avoid giant generic tables
- use migrations
- keep relationships explicit

Important:
Design schema BEFORE implementing features.

---

# SECURITY REQUIREMENTS

Must protect against:
- SQL injection
- XSS
- CSRF
- websocket abuse
- unauthorized access
- token theft

Rules:
- validate every input
- sanitize outputs if needed
- hash passwords properly
- secure cookies
- never trust frontend input

---

# REAL-TIME SYNCHRONIZATION

Network issues will happen:
- latency
- jitter
- disconnects
- reconnections

The architecture must tolerate:
- page refresh
- socket reconnect
- temporary network loss

Backend cleanup is mandatory:
- remove dead sockets
- cleanup unfinished games
- cleanup matchmaking queues

---

# IMPORTANT ENGINEERING RULES

## DO NOT MIX RESPONSIBILITIES

Bad:
- UI handling physics
- websocket handling business logic
- auth mixed with game engine

Good:
- isolated modules
- clear interfaces
- independent systems

---

## SINGLE SOURCE OF TRUTH

Backend owns:
- authentication validity
- match state
- score
- tournament state

Frontend mirrors backend state.

---

## SMALL STABLE MODULES

Every module should be understandable independently.

A developer should be able to explain:
- auth
- websocket
- game
- chat
- database

without opening the entire project.

---

# DEVELOPMENT ROADMAP

## PHASE 1
Infrastructure
- Docker
- backend startup
- frontend startup
- database connection
- environment variables

## PHASE 2
Authentication
- login
- register
- JWT/session
- protected routes

## PHASE 3
Database
- schema
- migrations
- repositories

## PHASE 4
REST API
- profiles
- friends
- history
- leaderboard

## PHASE 5
WebSocket
- chat
- online presence
- invitations

## PHASE 6
Local Pong
- game engine
- rendering
- collisions

## PHASE 7
Network Pong
- synchronization
- authoritative server
- matchmaking

## PHASE 8
Polish
- tournaments
- statistics
- security hardening
- testing

---

# COMMON FAILURE POINTS

## 1. Starting with graphics first
Wrong priority.

Infrastructure and auth come first.

---

## 2. No architecture boundaries
Creates massive technical debt.

---

## 3. Giant websocket handler
Must be modular.

---

## 4. Client authoritative gameplay
Creates cheating and desync issues.

---

## 5. Shared mutable frontend state chaos
Need centralized predictable state management.

---

## 6. Ignoring disconnect handling
Always handle:
- reconnect
- refresh
- timeout
- abandoned games

---

# TEAM ORGANIZATION

Recommended:
- one person focuses backend core/auth
- one person frontend/state/UI
- one person game engine
- one person websocket/matchmaking

BUT:
Architecture decisions are shared by everyone.

---

# GIT WORKFLOW

Rules:
- never push directly to main
- feature branches only
- small pull requests
- meaningful commit messages
- code reviews before merge

---

# PERFORMANCE GOALS

Priority order:
1. stability
2. security
3. maintainability
4. synchronization correctness
5. visual polish

Do not optimize prematurely.

---

# WHAT THE PROJECT SHOULD FEEL LIKE

The application should feel:
- stable
- responsive
- modular
- secure
- predictable

Not:
- overengineered
- tightly coupled
- dependent on hacks
- difficult to debug

---

# FINAL IMPORTANT RULES

- The backend is authoritative.
- The game engine is isolated.
- WebSocket transports events only.
- Frontend mirrors backend state.
- Security is mandatory.
- Architecture clarity is more important than flashy features.
