.PHONY: help install dev build test clean docker-up docker-down

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	pnpm install

dev: ## Run API in development mode
	pnpm run dev

dev-worker: ## Run Worker in development mode
	pnpm run dev:worker

build: ## Build all packages
	pnpm run build

lint: ## Run linter
	pnpm run lint

lint-fix: ## Fix linting issues
	pnpm run lint:fix

format: ## Format code
	pnpm run format

test: ## Run tests
	pnpm run test

test-e2e: ## Run e2e tests
	pnpm run test:e2e

typecheck: ## Run TypeScript type checking
	pnpm run typecheck

clean: ## Clean build artifacts and node_modules
	pnpm run clean

docker-up: ## Start Docker services
	docker-compose up -d

docker-down: ## Stop Docker services
	docker-compose down

docker-logs: ## Show Docker logs
	docker-compose logs -f

db-migrate: ## Run database migrations
	pnpm run db:migrate

db-seed: ## Seed database
	pnpm run db:seed

