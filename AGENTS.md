# AGENTS.md

## Repo layout

Three independent apps (no workspace manager, no shared root scripts):

| App | Path | Stack |
|---|---|---|
| Backend | `ConnectionAppBackend/` | Spring Boot 3.5, Java 21, Maven |
| Web | `ConnectionAppWeb/` | React 19, TS, Vite 7, TailwindCSS v4, shadcn/ui |
| Mobile | `ConnectionAppMobile/AppChatMobile/` | Expo 54, React Native 0.81, TS |

## Developer commands

### Backend (`ConnectionAppBackend/`)
- `./mvnw spring-boot:run` — start dev server (default port 8080)
- `./mvnw clean package` — build jar (skip tests: `-DskipTests`)
- `./mvnw test` — run tests
- Lombok is on the annotation processor path; IDEs need Lombok plugin enabled

### Web (`ConnectionAppWeb/`)
- `npm run dev` — Vite dev server (default port 5173)
- `npm run build` — typecheck + production build (`tsc -b && vite build`)
- `npm run lint` — ESLint
- `npm run preview` — preview production build locally
- Path alias: `@/*` → `./src/*`

### Mobile (`ConnectionAppMobile/AppChatMobile/`)
- `npm start` — `expo start --dev-client` (requires dev-client build)
- `npm run start:lan:auto` — LAN dev via `scripts\start-lan-dev-client.cmd`
- `npm run android:lan:auto` — Android LAN via `scripts\android-lan-dev-client.cmd`
- Physical devices need a **dev-client build** (`npx expo run:android` / `npx expo run:ios`) — Expo Go is NOT supported

## Backend details

- **Dual database**: MariaDB (`appChat` DB, JPA) for users/friends/conversations/calls; MongoDB (`appchat`) for messages
- **No migrations**: `spring.jpa.hibernate.ddl-auto=update` — schema auto-updates on startup
- **MongoDB auto-index creation** is enabled
- **Auth**: JWT with refresh tokens, OTP email verification, account lock on policy violations
- **JWT secret** is hardcoded in `application.properties` (not ideal, but that's how it works)
- **Realtime chat**: STOMP over WebSocket (`ChatRealtimeController`), authenticated via `WebSocketAuthInterceptor`
- **Storage**: AWS S3 (`S3StorageService`) for image/file uploads
- **AI**: Gemini for group media safety filtering and message rewrite
- **Calls**: Zego Cloud integration (`CallController`, `CallService`, `CallTimeoutScheduler`)
- **Env loading**: uses `spring-dotenv` — `.env` file is read automatically (not standard Spring Boot)
- **Default server binds** to `0.0.0.0`, not just localhost
- Entry point: `ConnectionAppBackendApplication.java` | Package: `iuh.fit.ConnectionAppBackend`

## Testing

- Backend: only `ConnectionAppBackendApplicationTests.java` (default smoke test). Run: `./mvnw test`
- Web: no test framework configured
- Mobile: no test framework configured

## Notes

- No CI/CD, no pre-commit hooks, no root `package.json`
- CORS allows wildcards for localhost, LAN ranges, ngrok, VS Code dev tunnels, and `exp://*` (Expo)
- `appchat.messages.json` and `test.sql` are dev/test data fixtures
