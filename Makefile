all: sanitize-volumes
	docker compose -f Sources/docker-compose.yml up -d --build

sanitize-volumes:
	@for volume in Sources_mariadb_data Sources_wordpress_data; do \
		if docker volume inspect $$volume >/dev/null 2>&1; then \
			if docker volume inspect -f '{{if .Options}}{{index .Options "o"}}{{end}}' $$volume | grep -q '^bind$$'; then \
				echo "Removing legacy bind-mounted volume $$volume"; \
				docker volume rm $$volume >/dev/null; \
			fi; \
		fi; \
	done

down:
	docker compose -f Sources/docker-compose.yml down

down-v:
	docker compose -f Sources/docker-compose.yml down -v

re: down all

clean: down
	docker system prune -af

fclean: clean
	docker volume prune -f

#reset: down-v
#	docker volume rm Sources_mariadb_data Sources_wordpress_data inception_mariadb_data inception_wordpress_data 2>/dev/null || true

dev: fclean
	@echo "Adding files from current directory only..."
	@git add . && git diff --cached --quiet || (git commit -m "Inception - auto/dev" && git push) || echo "No changes to commit"

.PHONY: all sanitize-volumes down down-v re clean fclean reset
