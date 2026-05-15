COMPOSE := docker compose -f Sources/docker-compose.yml

all: up

help:
	@echo "Usage:"
	@echo "  make up      - build and start services"
	@echo "  make build   - build images"
	@echo "  make down    - stop services"
	@echo "  make logs    - follow logs"
	@echo "  make ps      - list containers"
	@echo "  make clean   - prune docker system"
	@echo "  make help    - this message"

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

clean: down
	docker system prune -af

fclean: clean
	docker volume prune -f

dev: fclean
	@echo "Adding files from current directory only..."
	@git add . && git diff --cached --quiet || (git commit -m "Transcendence - auto/dev" && git push) || echo "No changes to commit"

.PHONY: all up build down down-v re restart logs ps clean fclean dev help