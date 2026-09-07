# Shared model artifacts

This repository-level directory is reserved for model artifacts that need to be shared across services or supplied by deployment tooling. It is intentionally empty in the current local layout.

The models currently consumed by FastAPI live in [`ai-service/models/`](../ai-service/models/), including YOLO detector weights, behaviour classifiers, and feature scalers. Training runs and evaluation evidence live under [`ai-service/runs/`](../ai-service/runs/).

Model files must never be placed in `frontend/` or served as public static assets. Before adding a large artifact, document its source, version, expected checksum, license, and runtime configuration.
