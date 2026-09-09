# --- DÉTECTION DU MATÉRIEL ---
HAS_NVIDIA := $(shell command -v nvidia-smi 2> /dev/null)
HAS_AMD := $(shell [ -e /dev/kfd ] && echo "yes" || echo "no")

COMPOSE := docker compose -f docker-compose.yml

ifneq ($(HAS_NVIDIA),)
	COMPOSE += -f docker-compose.nvidia.yml
	GPU_MSG := "🟢 GPU NVIDIA détecté. Configuration ajoutée."
else
	ifeq ($(HAS_AMD),yes)
		COMPOSE += -f docker-compose.amd.yml
		GPU_MSG := "🔴 GPU AMD détecté. Configuration ajoutée."
	else
		GPU_MSG := "⚪ Aucun GPU compatible détecté. Mode CPU."
	endif
endif
# -----------------------------

all: up

help:
	@echo "Usage:"
	@echo "  make up          - Build and start all services in background"
	@echo "  make build       - Build images cleanly"
	@echo "  make down        - Stop and remove containers"
	@echo "  make re          - Restart all services"
	@echo "  make logs        - Follow logs of all containers"
	@echo "  make ps          - List running containers"
	@echo "  make prisma-push - Synchronize Prisma schema with Postgres"
	@echo "  make clean       - Stop containers and remove project images"
	@echo "  make fclean      - Deep clean: remove containers, images, and ALL data volumes"

up:
	@echo $(GPU_MSG)
	$(COMPOSE) up -d --build

build:
	@echo $(GPU_MSG)
	$(COMPOSE) build --progress=plain

down:
	$(COMPOSE) down

down-v:
	make fclean

re: down up

restart: down up

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

# Force la synchronisation du schéma Prisma directement sur la base en cours d'exécution
prisma-push:
	$(COMPOSE) exec backend npx prisma db push

# Supprime les conteneurs et les images créées par ce projet spécifiquement
clean:
	$(COMPOSE) down --rmi all --remove-orphans

# Supprime les conteneurs, les images ET les volumes de données (Postgres & Ollama)
fclean:
	$(COMPOSE) down -v --rmi all --remove-orphans
	@echo "✨ Tout est propre. Les volumes de données ont été détruits."

.PHONY: all up build down down-v re restart logs ps prisma-push clean fclean help