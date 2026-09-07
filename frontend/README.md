# Virtual Guard frontend

React and TypeScript security operations console for Virtual Guard. It provides live monitoring, camera assignment, incident review, analytics, reports, review history, guard management, and camera settings.

See the [main project README](../README.md) for architecture, setup, service communication, security guidance and testing commands.

## Run locally

```powershell
npm install
npm run dev
```

The development server runs at `http://localhost:5173` and expects the Spring Boot API at `http://localhost:8090`.

## Verify changes

```powershell
npm run lint
npm run build
```

Do not place model weights, evidence videos, credentials, or backend secrets in this directory.
