# Virtual Guard backend

Spring Boot API, job orchestration, authentication, and persistence layer for
Virtual Guard. The React frontend communicates only with this service; AI work
is dispatched to the FastAPI service, which reports progress and results through
API-key-protected internal callbacks.

## Implemented

- JWT login and role-based access for administrators and security guards
- Camera and guard APIs backed by PostgreSQL
- Multipart video upload and local video storage
- Asynchronous analysis job submission and progress polling
- AI callback processing with duplicate-callback protection
- Suspicious-result incident creation and human review transitions
- Annotated video delivery with byte-range support
- Incident analytics and client-side CSV report exports
- Bounded AI-service calls and retry-safe internal callbacks

## Not implemented yet

- Refresh-token rotation
- Scheduled/server-generated reports
- Durable external job queue and automatic retry processing
- Production object storage and retention policies

## Run locally

Start PostgreSQL and the AI service first, then run:

```powershell
mvn spring-boot:run
```

The backend listens at `http://localhost:8090`. Configuration and secrets are loaded from the repository-level `.env` file; begin with [`.env.example`](../.env.example) and never commit `.env`.

## Local services

- Backend: `http://localhost:8090`
- FastAPI AI service: `http://localhost:8000`
- Frontend: `http://localhost:5173`
- PostgreSQL: `localhost:5432`

## Verify changes

```powershell
mvn test
```

See the [main project README](../README.md) for complete setup instructions and the [architecture reference](../docs/architecture.md) for the distinction between the current prototype and future work.
