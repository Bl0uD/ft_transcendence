COMPOSE := docker compose -f docker-compose.yml

all: up

help:
	@echo "Usage:"
	@echo "  make up      - Build and start all 5 services in background"
	@echo "  make build   - Build images cleanly"
	@echo "  make down    - Stop and remove containers"
	@echo "  make re      - Restart all services"
	@echo "  make logs    - Follow logs of all containers"
	@echo "  make ps      - List running containers"
	@echo "  make clean   - Stop containers and remove project images"
	@echo "  make fclean  - Deep clean: remove containers, images, and ALL data volumes"

up:
	$(COMPOSE) up -d --build

build:
	$(COMPOSE) build --progress=plain

down:
	$(COMPOSE) down

down-v:
	$(COMPOSE) down -v

re: down up

restart: down up

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

# Supprime les conteneurs et les images créées par ce projet spécifiquement
clean:
	$(COMPOSE) down --rmi all --remove-orphans

# Supprime les conteneurs, les images ET les volumes de données (Postgres & Ollama)
fclean:
	$(COMPOSE) down -v --rmi all --remove-orphans
	@echo "✨ Tout est propre. Les volumes de données ont été détruits."

.PHONY: all up build down down-v re restart logs ps clean fclean help