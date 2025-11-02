# Observability Platform

An open-source observability platform built with OpenTelemetry, featuring a modern web dashboard, high-performance ingestion backend, and easy-to-use SDKs.

## 🏗️ Project Structure

```
obs/
├── apps/
│   ├── web/              # Main dashboard (Next.js)
│   ├── docs/             # Documentation site (Fumadocs)
│   ├── server/           # Backend ingestion API (FastAPI)
│   └── collector/        # OTEL Collector configuration
├── packages/             # Shared libraries and SDKs (future)
├── infra/
│   └── docker/           # Docker Compose configurations
├── package.json          # Root workspace config
├── pnpm-workspace.yaml   # PNPM workspace definition
└── turbo.json            # Turborepo configuration
```

## 🚀 Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 10
- [Python](https://www.python.org/) >= 3.13
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- [Docker](https://www.docker.com/) and Docker Compose

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd obs
   ```

2. **Install dependencies**
   ```bash
   # Install frontend dependencies
   pnpm install

   # Install backend dependencies
   cd apps/server
   uv sync
   cd ../..
   ```

3. **Start development servers**
   ```bash
   # Start all backend services (PostgreSQL, PgBouncer, OTEL Collector, API Server)
   cd infra/docker
   docker-compose up -d
   # Backend API will be available at http://localhost:8000

   # Start frontend (in another terminal)
   cd ../..
   pnpm dev:web      # Main dashboard on http://localhost:3001
   # or
   pnpm dev:docs     # Documentation on http://localhost:4000
   ```

   **Alternative:** Run backend locally (without Docker)
   ```bash
   cd apps/server
   PYTHONPATH=src uv run fastapi dev src/main.py
   ```

## 📦 Apps & Packages

### Apps

- **[web](apps/web/)** - Main observability dashboard
  - Next.js 16 with Turbopack
  - React 19
  - TailwindCSS 4
  - Runs on port 3001

- **[docs](apps/docs/)** - Documentation site
  - Built with [Fumadocs](https://fumadocs.vercel.app/)
  - Runs on port 4000

- **[server](apps/server/)** - Backend ingestion API
  - FastAPI with async PostgreSQL
  - OTLP trace ingestion endpoint
  - Runs on port 8000

- **[collector](apps/collector/)** - OTEL Collector config
  - Receives telemetry on ports 4317 (gRPC) and 4318 (HTTP)

### Packages

Coming soon: SDK packages for Python, JavaScript/TypeScript, and other languages.

## 🛠️ Development

### Available Scripts

```bash
# Frontend (from root)
pnpm dev              # Start all frontend apps in dev mode
pnpm dev:web          # Start main dashboard only
pnpm dev:docs         # Start docs site only
pnpm build            # Build all apps
pnpm check-types      # Type check all apps

# Backend (from apps/server)
PYTHONPATH=src uv run fastapi dev src/main.py   # Start dev server
uv run python -m pytest                         # Run tests
uv sync                                         # Install dependencies
```

### Server Structure

```
apps/server/
├── src/
│   ├── db/                   # Database layer
│   │   ├── __init__.py
│   │   ├── connection.py
│   │   └── schema.sql
│   ├── __init__.py
│   ├── main.py               # FastAPI app & routes
│   ├── models.py             # Pydantic models for OTLP
│   └── utils.py              # Data transformation utilities
├── tests/                    # Test files
├── Dockerfile
└── pyproject.toml
```

The server uses a simple src-layout pattern with PYTHONPATH pointing to the src directory.
All imports are relative from src/ (e.g., `from db.connection import get_db`).
```

## 🐳 Docker

### Development

```bash
cd infra/docker
docker-compose up -d
```

This starts all backend services:
- **PostgreSQL** (port 5432) - Database
- **PgBouncer** (port 6432) - Connection pooler
- **OTEL Collector** (ports 4317, 4318) - Telemetry receiver
- **Backend Ingestor** (port 8000) - FastAPI application

To view logs:
```bash
docker-compose logs -f ingestor  # Backend API logs
docker-compose logs -f           # All services
```

To stop all services:
```bash
docker-compose down
```

### Production

Build and run:
```bash
cd apps/server
docker build -t observ-server .
docker run -p 8000:8000 -e DATABASE_URL=<url> observ-server
```

## 📚 API Endpoints

### Traces Ingestion

**POST** `/v1/traces`

Accepts OTLP JSON format traces.

Example:
```bash
curl -X POST http://localhost:8000/v1/traces \\
  -H "Content-Type: application/json" \\
  -d @trace.json
```

## 🗄️ Database

The platform uses PostgreSQL with the following schema:

- `spans` table - Stores trace spans with JSONB attributes

See [apps/server/src/db/schema.sql](apps/server/src/db/schema.sql) for details.

## 🧪 Testing

```bash
# Backend tests
cd apps/server
uv run pytest

# Frontend tests (coming soon)
pnpm test
```

## 📖 Documentation

Visit the docs site at `http://localhost:4000` when running locally, or check the [apps/docs/content](apps/docs/content) directory.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the terms specified in [LICENSE](LICENSE).

## 🙏 Acknowledgments

Built with:
- [OpenTelemetry](https://opentelemetry.io/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Next.js](https://nextjs.org/)
- [PostgreSQL](https://www.postgresql.org/)
- [Turborepo](https://turbo.build/)
