# Setup and operations

## Preferred path: Docker Compose

Use Docker Compose to run PostgreSQL, Spring Boot, FastAPI and the frontend together. Native Windows commands below are for development. Run commands from the repository root unless a service directory is specified. Commands use PowerShell and contain no workstation-specific paths.

### Prerequisites

- Docker Desktop running Linux containers, with Docker Compose available.
- Sufficient disk and memory for Python/PyTorch image builds, model files and recordings. Initial builds download substantial dependencies.
- Runtime artifacts in `ai-service/models/`: `virtual_guard_mall_detector_v2.pt`, `yolov8n-pose.pt`, `behaviour_model_v2.pkl` and `scaler_v2.pkl`. Preserve the supplied V1/base artifacts for alternative detector selection.
- Datasets are not needed for inference, but are needed for relevant evaluation/data tests and are not necessarily present in a fresh Git clone.

### Private configuration

If `.env` does not already exist:

```powershell
Copy-Item .env.example .env
```

Edit that local file. Never overwrite working credentials just to follow this guide. `.env.example` contains placeholders, not usable credentials.

| Setting | Purpose |
|---|---|
| `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL initialization and backend connection |
| `JWT_SECRET` | Standard Base64 encoding of at least 32 random bytes |
| `INTERNAL_API_KEY` | Long random key shared by Java and Python |
| `BOOTSTRAP_USERS_ENABLED` | Set `true` only when creating initial local accounts |
| `BOOTSTRAP_PASSWORD` | Private strong password for missing bootstrap accounts |
| `GUARD_TEMPORARY_PASSWORD` | Private guard-reset password: at least 12 characters, at most 72 UTF-8 bytes |
| `VISION_MODEL` | Template selects `v2`; alternatives `v1` and `base` |
| `VISION_ANALYSIS_FPS` | Approximate sampled vision FPS; default 5 |
| `POSE_ENABLED` | Default true; retain for human pose overlays |
| `MAX_CONCURRENT_ANALYSES` | Default 1 in Compose |

Generate separate random secrets locally, for example using an installed Python:

```powershell
python -c "import secrets,base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Store generated values only in private configuration. Do not reuse example placeholders. Configure the guard temporary password before using reset; it is never shown or emailed by the application.

When enabled, bootstrap creates missing `admin@virtualguard.com` and `guard@virtualguard.com` accounts using your configured bootstrap password. These are code-defined identifiers, not public credentials. Existing account passwords are not changed by bootstrap. Disable bootstrap after initial provisioning if it is no longer needed.

### Start the stack

```powershell
docker compose up -d --build
docker compose ps
```

Wait for healthy services. Open http://localhost:8080 by default. Authenticate with the account and private password configured for your installation.

| Service | Default host port | Override |
|---|---:|---|
| Frontend | 8080 | `FRONTEND_PORT` |
| Backend | 8090 | `BACKEND_PORT` |
| AI | 8000 | `AI_PORT` |
| PostgreSQL | 5432 | `POSTGRES_PORT` |

All published ports bind to `127.0.0.1`. Existing `.env` overrides take precedence. Changing the frontend host port requires matching `DOCKER_CORS_ALLOWED_ORIGINS`. Changing the backend host port requires matching `DOCKER_API_BASE_URL` and rebuilding the frontend, because its API address is compiled into static assets. Container-to-container URLs remain `postgres:5432`, `ai-service:8000` and `backend:8090`.

```powershell
docker compose logs -f backend ai-service
docker compose stop
docker compose start
# Apply configuration or source changes:
docker compose up -d --build
```

`stop` preserves containers/data; `down` removes containers but retains the named database volume by default. Do not add `--volumes` unless intentionally deleting the database. Changing initialization credentials does not change passwords in an existing PostgreSQL volume.

### Storage and image contents

Both processing services mount `backend/uploads/` at `/data/uploads`. This shared absolute path is required: FastAPI reads paths supplied by Spring Boot. Recording directories are created as needed. Preserve existing media referenced by database jobs/incidents; back up the database and media together.

The database uses Compose's `postgres_data` named volume. The AI image copies runtime models, not datasets or training scripts. Local `.env` files are excluded from application images. Compose passes required variables explicitly. Native `CUSTOM_MODEL_PATH`/`BASE_MODEL_PATH` overrides are not forwarded into the containers; select an included model with `VISION_MODEL`.

The frontend uses Node 24 to build and Nginx to serve. Backend builds with Maven/Java 17 and runs on Java 17. The AI runtime uses Python 3.11 and CPU PyTorch. Dockerfiles are `frontend/Dockerfile.runtime`, `backend/Dockerfile.runtime` and `ai-service/Dockerfile`.

## Native Windows development

Prerequisites: Java 17, Maven, Node.js 24/npm, Python 3.11 with launcher `py`, and PostgreSQL (Compose can supply it). Python 3.13 is supported by the existing local `venv313` installation; Python 3.11 matches the Docker reference. A fresh dependency resolution can differ where Python requirements are unpinned.

Keep root `.env` configured. Stop containerized application services before binding the same native ports:

```powershell
docker compose stop frontend backend ai-service
docker compose up -d postgres
docker compose ps
```

The backend reads root `.env` through its Spring configuration. AI loads root `.env` before local dotenv discovery; process environment values take precedence. Keep duplicate local configuration consistent. Never copy secrets into frontend variables: `VITE_` settings are public browser configuration.

### Create the Python environment

From the repository root:

```powershell
cd ai-service
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt -r requirements-dev.txt
cd ..
```

If using the existing `venv313`, substitute that directory for `.venv`; activation is unnecessary when invoking its Python executable directly. Avoid accidentally using an unrelated global Python installation.

### Start Spring Boot (terminal 1)

```powershell
cd backend
mvn.cmd spring-boot:run
```

Wait for `Started VirtualGuardApplication`. Native backend defaults to port 8090 and uses `POSTGRES_PORT` from root configuration for the local database. Compose `BACKEND_PORT` changes a host mapping, not the native application's listening port.

### Start FastAPI (terminal 2)

```powershell
cd ai-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Wait for `Application startup complete`. For the existing environment, use `.\venv313\Scripts\python.exe` instead. Native callbacks use `SPRING_BOOT_URL`, normally `http://localhost:8090`; the backend defaults to FastAPI at `http://localhost:8000`.

### Start React (terminal 3)

```powershell
cd frontend
npm.cmd ci
npm.cmd run dev
```

Use the URL printed by Vite (normally http://localhost:5173). The API URL defaults to http://localhost:8090; set `VITE_API_BASE_URL` in private frontend configuration when needed. Native browser origins must match `CORS_ALLOWED_ORIGINS`. `.env.production` applies to production Vite builds, not ordinary development startup. `npm.cmd` avoids PowerShell script-policy problems with `npm.ps1`.

Press Ctrl+C in each terminal to stop native services. To return to the complete Docker stack, stop native processes, then run `docker compose up -d` from the root. Windows absolute recording paths already stored in a native database are not automatically migrated to container paths; upload recordings through the selected execution mode.

## Verification

Health/configuration checks from the root:

```powershell
docker compose config --quiet
docker compose ps
Invoke-RestMethod http://localhost:8090/health
Invoke-RestMethod http://localhost:8000/health
```

Health responses confirm service reachability; a successful upload, analysis and playback are stronger end-to-end checks. Model readiness should also be inspected in the AI health response.

Frontend, from `frontend`:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

Backend, from `backend`:

```powershell
mvn.cmd test
```

Six PostgreSQL integration tests are opt-in. Set `AUDIT_DB_URL` (JDBC URL without a query string), `AUDIT_DB_USER` and `AUDIT_DB_PASSWORD` privately before running Maven. They require permission to create/drop an isolated randomly named schema; without those variables they are skipped. Do not put credentials into a shared command transcript.

AI, from `ai-service`, using the chosen environment:

```powershell
.\.venv\Scripts\python.exe -B -m pytest tests -q -p no:cacheprovider
```

Run from the AI directory because some fixtures use relative paths. The suite covers configuration, feature schema, job attempts, failures, evidence, tracking, pose and model-cache behaviour. It does not retrain models. Tests/builds may generate ignored output; remove disposable output after use, preserving runtime recordings.

Optional browser regression scripts in `frontend/tests/` use Playwright. Install Chromium with `npx playwright install chromium`, or set `BROWSER_CHANNEL=msedge` for an installed Edge. Set `UI_BASE_URL` to the running frontend (script default is localhost:5180). `submission-ui.mjs`, `incidents-browser.mjs` and `browser-audit.mjs` intercept APIs; they do not prove real backend integration. `submission-ui.mjs` writes ignored screenshots under `output/`.

`live-auth-browser.mjs` and `scripts/verify_running_stack.py` are opt-in local integration checks that create temporary records and attempt scoped cleanup. They require private local credentials and Docker access; the latter also uses supplied data and writes ignored results. Inspect them before running against any installation with valuable records. CI currently runs frontend checks and backend tests; it does not run the AI suite or opt-in database tests by default.

## Password administration

Use Guards > profile > Reset password as an administrator. Share the configured temporary password privately. The guard must set a new password before accessing other features; resetting a suspended account does not reactivate it. Both roles can change their own password from the account menu. Changing `.env` bootstrap values is not an existing-account password-reset mechanism.

## Troubleshooting

| Symptom | Check |
|---|---|
| Docker engine unavailable | Start Docker Desktop and select Linux containers |
| Port already allocated | Stop the competing native/container service or use matching host-port/CORS overrides |
| Compose requires an API key/JWT value | Populate private root `.env`; placeholders are not valid secrets |
| Database authentication fails after changing `.env` | Existing volume keeps its database password; restore matching settings or explicitly administer the database |
| Browser CORS/network error | Check backend host URL, allowed origin and frontend rebuild after build-time URL changes |
| Missing Python module or incompatible interpreter | Use the chosen environment's executable and install its requirements |
| Model missing / AI not ready | Verify artifact paths and rebuild AI after intentional artifact changes; do not train as a startup fix |
| Invalid login/session revoked | Check current account password and guard status; bootstrap does not reset existing users |
| Reset unavailable | Configure a valid private `GUARD_TEMPORARY_PASSWORD` and ensure the guard has a login account |
| Recording path missing in Docker | Both services must use the same bind mount; native absolute paths are not portable |
| Analysis slow or failed | Inspect AI/backend logs; CPU inference and video encoding take time; retry failed jobs explicitly |
| Browser reload gives a 404 | Use the supplied Nginx SPA configuration or Vite development server |

## Distribution boundaries

`.env`, virtual environments, `node_modules`, build outputs, logs and runtime uploads are ignored/excluded. Keep `.env.example` with placeholders. The packaging script selects the three technical documents and curated image assets, source, tests, final models and saved experiment evidence; it excludes intermediate run checkpoints, obsolete experiment prose and model archives. `python scripts/package_submission.py --profile both` creates Full and Portfolio archives under `output/`, each with an internal SHA-256 manifest and an external archive checksum. Full includes all supplied datasets. Portfolio retains the small feature CSVs but omits the large mall and pose image/video datasets. Both support runtime inference. The full AI suite's `test_mall_dataset_validates` and the dataset-backed `verify_running_stack.py` smoke check require the Full datasets; they are not self-contained in Portfolio. For Portfolio-only AI checks, use `python -B -m pytest tests -q -k "not test_mall_dataset_validates" -p no:cacheprovider`. The stored-feature behaviour evaluator remains available in both packages. A Git clone may omit ignored local datasets even though a later package can include supplied data.

Historical experiment metadata retains original machine paths as provenance; do not treat those as runnable setup commands. Review artifact licensing and provenance before distribution. No ZIP is needed to run or review the repository.
