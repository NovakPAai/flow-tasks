.PHONY: dev backend frontend infra stop clean seed test lint setup

# --- First time setup ---
setup: infra
	cp -n .env.example .env 2>/dev/null || true
	cd backend && npm install
	cd frontend && npm install
	cd backend && npx prisma migrate dev --name init
	cd backend && npm run db:seed
	@echo "Setup complete! Run 'make dev' to start."

# --- Infrastructure (Postgres + Redis) ---
infra:
	docker compose up -d
	@echo "Waiting for PostgreSQL..."
	@until docker compose exec -T postgres pg_isready -U flowtask >/dev/null 2>&1; do sleep 1; done
	@echo "PostgreSQL ready on :5434, Redis ready on :6380"

# --- Dev servers ---
backend: infra
	cd backend && npm run dev

frontend:
	cd frontend && npm run dev

# Start both backend and frontend (backend in background)
dev: infra
	@echo "Starting backend on :3101 and frontend on :5174..."
	@cd backend && npm run dev &
	@cd frontend && npm run dev

# --- Database ---
seed:
	cd backend && npm run db:seed

db-push:
	cd backend && npm run db:migrate:deploy

db-reset:
	cd backend && npm run db:migrate:reset && npm run db:seed

db-studio:
	cd backend && npx prisma studio

# --- Quality ---
test:
	cd backend && npm test

lint:
	cd backend && npm run lint

# --- Git workflow ---
sync:
	@git fetch origin
	@git rebase origin/main
	@echo "Synced with origin/main"

pr:
	@git push -u origin $$(git branch --show-current)
	@gh pr create --fill

ship: sync lint pr

merge:
	@gh pr merge --squash --delete-branch

# --- Cleanup ---
stop:
	docker compose down
	@-pkill -f "tsx watch" 2>/dev/null || true
	@-pkill -f "vite" 2>/dev/null || true
	@echo "All services stopped"

clean: stop
	docker compose down -v
	rm -rf backend/node_modules frontend/node_modules
	@echo "Cleaned up volumes and node_modules"
