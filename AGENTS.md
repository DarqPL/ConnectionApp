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

## Env setup

Each app has its own `.env` (gitignored) and `.env.example`:
- **Backend** (`ConnectionAppBackend/.env`): must set `DB_PASSWORD`, `MAIL_USERNAME`/`MAIL_PASSWORD` (Gmail app password), `S3_*` keys, `GEMINI_API_KEY`, `ZEGO_APP_ID`/`ZEGO_SERVER_SECRET`. Admin account auto-seeded on first startup (`APP_ADMIN_USERNAME`/`APP_ADMIN_PASSWORD`).
- **Web** (`ConnectionAppWeb/.env`): optional `VITE_API_BASE_URL` (backend URL), `VITE_DEV_SERVER_HOST` (LAN).
- **Mobile** (`ConnectionAppMobile/AppChatMobile/.env`): optional `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_ZEGO_APP_ID`/`EXPO_PUBLIC_ZEGO_APP_SIGN`.

## Backend details

- **Dual database**: MariaDB (`appChat` DB, JPA) for users/friends/conversations/calls; MongoDB (`appchat`) for messages
- **No migrations**: `spring.jpa.hibernate.ddl-auto=update` — schema auto-updates on startup
- **MongoDB auto-index creation** is enabled
- **Auth**: JWT with refresh tokens, OTP email verification (Gmail SMTP), account lock on policy violations (configurable duration, default 30min)
- **JWT secret** is hardcoded in `application.properties` (not ideal, but that's how it works)
- **Realtime chat**: STOMP over WebSocket (`ChatRealtimeController`), authenticated via `WebSocketAuthInterceptor`
- **Storage**: AWS S3 (`S3StorageService`) for image/file uploads (default prefix: `images`)
- **AI**: Gemini for group media safety filtering and message rewrite (both use `gemini-2.0-flash` default)
- **Calls**: Zego Cloud integration (`CallController`, `CallService`, `CallTimeoutScheduler`)
- **Env loading**: uses `spring-dotenv` — `.env` file is read automatically (not standard Spring Boot)
- **Default server binds** to `0.0.0.0`, not just localhost
- **Email templates**: Thymeleaf (`spring-boot-starter-thymeleaf`)
- Entry point: `ConnectionAppBackendApplication.java` | Package: `iuh.fit.ConnectionAppBackend`

## Testing

- Backend: only `ConnectionAppBackendApplicationTests.java` (default smoke test). Run: `./mvnw test`
- Web: no test framework configured
- Mobile: no test framework configured, no lint or typecheck scripts

## Notes

- No CI/CD, no pre-commit hooks, no root `package.json`
- CORS defaults cover localhost, private LAN ranges (`192.168.*`, `10.*`, `172.16-31.*`), ngrok, and `exp://*` (Expo). VS Code dev tunnel domains must be added via `APP_CORS_ALLOWED_ORIGIN_PATTERNS` env var.
- `appchat.messages.json` and `test.sql` are dev/test data fixtures
- Web state management: Zustand (`zustand`), routing: React Router v7
- Upload limit: default 10MB backend, 2MB web/mobile (configurable via env)
