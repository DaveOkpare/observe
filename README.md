# High-Throughput Observability System

A tracing system built using OpenTelemetry, PostgreSQL, and high-performance COPY FROM ingestion.

## Architecture

```
Applications � OpenTelemetry Collector � FastAPI Backend � PostgreSQL (via PgBouncer)
```

- **OpenTelemetry Collector**: Receives and batches OTLP traces
- **FastAPI Backend**: Processes traces with high-performance database insertion
- **PostgreSQL + PgBouncer**: Optimized storage with connection pooling
- **COPY FROM**: 8-10x faster bulk ingestion vs traditional INSERT methods

## Quick Start

### 1. Start the Infrastructure
```bash
docker-compose up -d
```

This starts:
- PostgreSQL (port 5432) with performance tuning
- PgBouncer (port 6432) for connection pooling  
- OpenTelemetry Collector (ports 4317/4318) for trace ingestion
- FastAPI Backend (port 8000) for trace processing

### 2. Send Traces to the System

**Configure your application's OpenTelemetry exporter:**

```python
# Python example
import os
os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://localhost:4318"
```

```javascript
// Node.js example
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
```

```yaml
# Docker Compose service
environment:
  - OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
```

**Or send directly via curl:**
```bash
curl -X POST -H "Content-Type: application/json" \
  -d @traces.json \
  http://localhost:4318/v1/traces
```

### 3. Query Your Data

```bash
# Connect to database via PgBouncer
PGPASSWORD=postgres psql -h localhost -p 6432 -U postgres -d observability

# Check inserted spans
SELECT COUNT(*) FROM spans;
```

## Configuration

### OpenTelemetry Collector Endpoints
- **HTTP**: `http://localhost:4318/v1/traces`  
- ~~**gRPC**: `http://localhost:4317/v1/traces`~~ (not added)

### Database Access
- **Application (via PgBouncer)**: `postgresql://postgres:postgres@localhost:6432/observability`
- **Direct PostgreSQL**: `postgresql://postgres:postgres@localhost:5432/observability`

## Performance Results

### Load Test Results

| Component | Test Type | Throughput | Configuration | Notes |
|-----------|-----------|------------|---------------|-------|
| **Full Pipeline** | End-to-end | 7,800 RPS | Single collector | Sustained, zero data loss |
| **Database Only** | Direct COPY FROM | 97,000 RPS | 1024 batch size | Peak performance |
| **Database Only** | Direct COPY FROM | 96,800 RPS | 512 batch size | Optimal efficiency |

### Batch Size Performance (Database Only)

| Batch Size | Throughput | Avg Batch Time | Efficiency |
|------------|------------|----------------|------------|
| 512 | 96,808 RPS | 12.7ms | 99.9% |
| **1024** | **96,943 RPS** | **25.1ms** | **100%** ✅ |
| 2048 | 80,578 RPS | 56.6ms | 83.1% |
| 4096 | 83,478 RPS | 107.1ms | 86.1% |
| 8192 | 71,584 RPS | 164.1ms | 73.8% |

### Architecture Features

- **COPY FROM insertion**: AsyncPG `copy_records_to_table()` for 8-10x performance vs INSERT
- **Optimized batching**: 500ms timeout, 1024 batch size (proven optimal)
- **Strategic indexing**: Trace ID, span ID, and time-based queries optimized
- **Connection pooling**: 200 client → 50 actual database connections
- **Zero data loss**: 100% span ingestion success rate under load

## System Requirements

- Docker & Docker Compose
- 2GB+ RAM recommended for PostgreSQL buffer tuning