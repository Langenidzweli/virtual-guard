# Frontend/backend feature integration audit

Implementation follow-up: see [AUDIT_FIX_CHECKLIST.md](AUDIT_FIX_CHECKLIST.md) for fixes and verification. The findings below preserve the original audit snapshot.

Reviewed 14 September 2026. Scope: React pages and service clients, Spring controllers/security/services/entities, and the Python callback boundary including review segments and pose rendering. This is an audit; no application fixes were made during this review.

**Verdict: the main API wiring exists, but the application is not fully connected or verified end to end.** Several controls promise effects that the backend does not implement. Passing unit tests and compilation do not establish correct multi-user, restart or browser playback behaviour.

## Verification performed

- Frontend `npm run build`: passed.
- Frontend `npm run lint`: passed.
- Backend `mvn test -q`: passed; Surefire reports 35 tests, zero failures/errors/skips.
- Reviewed request methods, paths, DTOs, persistence and permissions for authentication, cameras, guards, jobs, reports, history, notifications, analytics and footage.
- Attempted live reads at localhost ports 5173, 8090 and 8000. Sandbox attempts failed to connect; checks outside the restricted network sandbox timed out. No successful live login, database mutation or browser interaction was established in this audit.
- The earlier pose implementation run passed 33 Python tests and a combined video-render smoke test. Those are prior verification, not a fresh AI-suite result for this audit.
- No browser automation capability was available in the active tools. Playback/navigation and concurrent requests require live acceptance tests.

## Findings in priority order

### F1 — High: “Deactivate account” does not disable an account

Evidence: [GuardsPage.tsx](../frontend/src/features/guards/GuardsPage.tsx), account-action buttons; [GuardService.java](../backend/src/main/java/com/virtualguard/backend/service/GuardService.java), `createGuard` and `updateGuardStatus`; [CustomUserDetailsService.java](../backend/src/main/java/com/virtualguard/backend/security/CustomUserDetailsService.java), `loadUserByUsername`.

The UI calls the operation “Deactivate account” and describes managing system access. The service changes only a `guards` profile row. Login reads the separate `users` table, and no guard-status check links these paths. Adding a guard also does not provision a login user.

Reproduction to perform: create a login user and guard profile with matching email, deactivate the profile, then attempt login. Source analysis shows the authentication path has no dependency on that status. This was not live-tested.

Fix direction: explicitly link user/profile identity and enforce disabled state during login, refresh and authenticated requests, or relabel the current control as profile-only until that integration exists. Test existing-token behaviour too.

### F2 — High: dispatch failure state can roll back

Evidence: [JobService.java](../backend/src/main/java/com/virtualguard/backend/service/JobService.java), `startJob`, lines around 102–133.

`startJob` is transactional. On a failed FastAPI call it saves FAILED and then throws a runtime exception. Under Spring's default rollback rules, the transaction rolls back, including that failure-state save. The expected failed/retry state is therefore not reliably persisted. Mockito tests cannot demonstrate a real transaction commit.

Fix direction: separate atomic job claiming, external dispatch and persisted failure handling into explicit transaction boundaries. Verify against a real database with an unavailable FastAPI endpoint. Also test callback arrival before dispatch transaction completion.

### F3 — High: competing requests can start or review the same record twice

Evidence: [JobService.java](../backend/src/main/java/com/virtualguard/backend/service/JobService.java), `startJob`; [IncidentService.java](../backend/src/main/java/com/virtualguard/backend/service/IncidentService.java), `createFromAiResult` and `reviewIncident`; [ProcessingJob.java](../backend/src/main/java/com/virtualguard/backend/entity/ProcessingJob.java), [Incident.java](../backend/src/main/java/com/virtualguard/backend/entity/Incident.java).

The code reads state, checks it, then writes without an explicit lock, version field or conditional update. Two requests can both observe QUEUED/PENDING_REVIEW. Duplicate callback prevention checks `existsByJobId` but the entity does not declare a unique job constraint. Browser click protection cannot protect against other tabs or clients.

This is a source-confirmed missing concurrency control, not an observed concurrent failure in this audit. Add atomic claims/versioning and a database uniqueness rule where intended; test competing starts, conflicting reviews and simultaneous callbacks.

### F4 — High: interrupted analysis has no durable recovery

Evidence: [routes.py](../ai-service/app/api/routes.py), `BackgroundTasks`, `analysis_slots`, callback retry functions; [JobService.java](../backend/src/main/java/com/virtualguard/backend/service/JobService.java), start guard.

Python work exists in memory. If Python exits during a job, no surviving task guarantees a FAILED callback. Java has no stale-processing recovery in the inspected flow, while PROCESSING jobs cannot be started again. The dashboard can consequently keep polling a job that will never finish.

Fix direction: durable task state/queue or a bounded stale-job reconciliation mechanism with attempt IDs. A late callback from an old attempt must not overwrite a newer attempt. Test restarting Python mid-analysis.

### F5 — Medium: investigation notes are not saved to the backend

Evidence: [ReportsPage.tsx](../frontend/src/features/reports/ReportsPage.tsx), `saveReview`; [HistoryPage.tsx](../frontend/src/features/history/HistoryPage.tsx), local note lookup; [incidentService.ts](../frontend/src/services/incidentService.ts).

Review outcomes reach Java, but notes are written only to localStorage. Another browser will not see them, and clearing browser data removes them. A “saved” result can therefore combine durable review state with a browser-only note. Local notes are also not scoped to the currently logged-in user.

Fix direction: persist notes and audit metadata through the review API; test retrieval in a separate session. Clearly distinguish draft notes from submitted review records.

### F6 — Medium: saved map positions are ignored for familiar labels

Evidence: [StoreMap.tsx](../frontend/src/features/dashboard/components/StoreMap.tsx), `mapPosition`; [SettingsPage.tsx](../frontend/src/features/settings/SettingsPage.tsx), `previewPosition`; [CameraService.java](../backend/src/main/java/com/virtualguard/backend/service/CameraService.java), `apply`.

Java saves x/y coordinates correctly, but both map functions substitute fixed positions for labels containing Storage, Aisle A/B, Checkout or Entrance. Editing those cameras' coordinates changes stored values without moving their displayed markers.

Fix direction: render saved coordinates through one shared mapping function. Verify an edited named camera moves consistently in Settings and Monitoring.

### F7 — Medium: “AI analysis is paused” is not enforced on the server

Evidence: [SettingsPage.tsx](../frontend/src/features/settings/SettingsPage.tsx), monitoring text; [JobService.java](../backend/src/main/java/com/virtualguard/backend/service/JobService.java), `submitJob`/`startJob`; [CameraService.java](../backend/src/main/java/com/virtualguard/backend/service/CameraService.java).

The monitored flag affects which feeds React displays. Job submission/start does not reject a camera with monitoring disabled, and toggling it does not pause an already running Python job. A stale tab or direct API request can still start work.

Fix direction: define whether this toggle controls display, admission of new work, or cancellation; enforce the chosen semantics server-side and use matching UI wording.

### F8 — Medium: report filters can leave an unrelated incident selected

Evidence: [ReportsPage.tsx](../frontend/src/features/reports/ReportsPage.tsx), `filtered`, `visible` and `selected`, around lines 77–89.

The detail selection searches the full `incidents` array, even when filters or pagination remove that incident from the visible list. Changing status/date/search can leave the detail pane and review action pointing at a record outside the displayed results.

Fix direction: reconcile selection with filtered/visible IDs whenever results change. Test filtering out the selected incident, zero results, pagination and reviewing a record that leaves the current status filter.

### F9 — Medium: footage authentication does not refresh expired tokens

Evidence: [apiClient.ts](../frontend/src/services/apiClient.ts), refresh branch; [CameraFeedCard.tsx](../frontend/src/features/dashboard/components/CameraFeedCard.tsx), video URL; [ReviewFootage.tsx](../frontend/src/components/ReviewFootage.tsx); [VideoController.java](../backend/src/main/java/com/virtualguard/backend/controller/VideoController.java).

JSON requests pass through the refresh-capable API client. HTML video requests go directly to a URL with a query token. When that token expires, a playback/range request receives 401 without invoking the client refresh flow. Another API request may later refresh the token, but the video request itself does not guarantee recovery.

Fix direction: coordinate playback authentication renewal, or use an appropriate renewable media access mechanism. Test expiry during playback and seeking rather than only initial video loading.

### F10 — Medium: camera alert state has competing frontend/backend logic

Evidence: [DashboardPage.tsx](../frontend/src/features/dashboard/DashboardPage.tsx), completion handler around lines 184–191; [CameraStatusService.java](../backend/src/main/java/com/virtualguard/backend/service/CameraStatusService.java), `refresh`.

React sets status from the latest completed clip and a hard-coded threshold of 70. Java calculates status from the highest-scoring pending incident, preserves OFFLINE and allows a configurable threshold. A completed normal clip can temporarily display NORMAL even with an older pending alert. The later camera refresh may correct it, but an unavailable refresh leaves the inconsistency visible.

Fix direction: use the authoritative camera response after completion/review and centralize threshold semantics. Test a camera with multiple pending incidents, an offline camera and a non-default threshold.

### F11 — Medium: “All time” analytics mixes date ranges

Evidence: [AnalyticsPage.tsx](../frontend/src/features/analytics/AnalyticsPage.tsx), `days`, `items`, `chartDays` around lines 35–45.

All-time selection includes all incidents in totals but sets `chartDays` to 30. The trend therefore shows only thirty days under an all-time selection, while other values include older incidents.

Fix direction: derive chart bounds from the selected range/data or label the trend explicitly as thirty days. Verify with an incident older than thirty days.

### F12 — Medium: history CSV lacks the formula guard used in reports

Evidence: [HistoryPage.tsx](../frontend/src/features/history/HistoryPage.tsx), `exportHistory`; [ReportsPage.tsx](../frontend/src/features/reports/ReportsPage.tsx), `csvCell`.

History quotes cells but does not neutralize spreadsheet formula prefixes. A camera label beginning with `=` can be interpreted as a formula when opened in spreadsheet software. Reports already uses a prefix guard, so export behaviour is inconsistent.

Fix direction: share the guarded CSV serializer across exports and test labels beginning with formula prefixes. Quoting alone protects CSV structure, not spreadsheet interpretation.

## Feature connection matrix

“Connected in source” means the route and data path match; it is not a live end-to-end pass.

| Feature | Frontend → backend path | Audit status |
|---|---|---|
| Login | AuthProvider → POST `/api/auth/login` → user lookup/password authentication | Connected in source; live login unverified. |
| Refresh | apiClient → POST `/api/auth/refresh` | Connected for JSON requests; media gap F9. No durable token revocation shown. |
| Logout | AuthProvider clears browser session | Local logout connected; existing issued tokens are not revoked server-side. |
| Role controls | RequireAuth and Spring Security | ADMIN guards/camera writes mapped. Incident review requires authentication, not ADMIN specifically; confirm intended role policy. |
| Camera list/create/update | cameraService → `/api/cameras` → CameraService/JPA | Contracts connected; display/toggle gaps F6–F7. |
| Guard profile CRUD/status | guardService → `/api/guards` → GuardService/JPA | Profile operations connected; account access claim fails F1. |
| Upload and conversion | FormData → POST `/api/jobs` → disk → FastAPI `/convert` | Connected; Java/Python require access to the same filesystem path. |
| Analysis start | POST `/api/jobs/{id}/start` → `/analyze` | Connected; lifecycle/concurrency gaps F2–F4. |
| Progress | Python internal callback → job row → React polling | Connected; stage percentages, not measured time remaining. |
| Detection and skeleton | Python detector/pose/tracker → annotated MP4 | Render path connected; pose is visual evidence, not classifier input. |
| Review segments | Python `review_segments` → incident JSON `reviewSegments` → detail GET → ReviewFootage | Contracts connected; old incidents fall back to full footage. Browser seek/pause/navigation not live-tested here. |
| Reports | Incident summaries/details → ReportsPage | Connected; selection and note gaps F5/F8. |
| Review outcome | PATCH `/api/incidents/{id}/review` → IncidentService | Persistence path connected; concurrent review gap F3. |
| History | GET incidents → frontend grouping/filtering | Connected; notes/export gaps F5/F12. |
| Notifications | GET `/api/notifications/count` → count pending rows | Connected; browser polls every ten seconds and on local change events. |
| Analytics | GET incidents → browser aggregation | Connected without a separate analytics endpoint; range gap F11. Average confidence is not accuracy. |
| Health indicator | Sidebar → Java `/health` | Indicates Java response only; not proof of database, AI or camera readiness. |
| Dashboard reset | Browser reset timestamp | Clears visible state only; does not delete/cancel jobs. |
| Live camera streaming | Stored camera stream URL | Continuous RTSP ingestion is not implemented. Uploaded clips supply the current workflow. |

## Acceptance tests still required on a running system

1. Log in as each role, test prohibited API actions directly, refresh credentials and log out.
2. Create/edit a camera and guard; verify persistence after restart and intended access semantics.
3. Upload a clip, start analysis, reload while processing and verify callbacks, annotated playback and incident creation.
4. Open Reports and History footage: verify first-segment seek, end pause, previous/next, replay, full recording, no-segment fallback and expired-token recovery.
5. Review an incident, reopen it in another browser and verify outcome, notes, notification count and camera aggregate state.
6. Test simultaneous starts/reviews/callbacks, AI restart, unavailable callback destination and missing video files.
7. Verify filtering/pagination selection, historical date ranges and exported spreadsheet contents.

Recommended repair order: account semantics and job lifecycle/concurrency first; durable review notes next; map/monitoring and report selection next; then playback renewal, status consistency and reporting/export issues. Passing these acceptance tests after repair is necessary before describing all features as working end to end.
