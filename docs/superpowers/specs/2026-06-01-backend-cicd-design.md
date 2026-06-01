# Backend CI/CD with GitHub Actions + SSH

**Date**: 2026-06-01

## Overview

Automated CI/CD pipeline for ConnectionAppBackend using GitHub Actions. Triggers on push to `main` branch, SSH into EC2, pulls latest code, rebuilds and restarts the backend container via Docker Compose production.

## Architecture

```
GitHub (push to main)
    │
    ▼
GitHub Actions Workflow
    ├── Job 1: Build & Test (ubuntu-latest)
    │       └── Verify Maven build succeeds
    │
    └── Job 2: Deploy to EC2 (ubuntu-latest)
            └── SSH → git pull → docker compose up --build backend
```

## Workflow: `backend-deploy.yml`

### Trigger
- Branch: `main` only
- Paths: `ConnectionAppBackend/**` (skip if only web/mobile changes)

### Job 1: Build & Test
- **Runner**: `ubuntu-latest`
- **Steps**:
  1. Checkout code
  2. Setup Java 21 (Eclipse Temurin)
  3. Cache Maven dependencies
  4. `./mvnw clean package -DskipTests -B`
- **Purpose**: Catch build failures early before deploying

### Job 2: Deploy to EC2
- **Runner**: `ubuntu-latest`
- **Dependency**: Requires Job 1 success
- **Steps**:
  1. SSH into EC2 using `appleboy/ssh-action@v1`
  2. Commands executed on EC2:
     ```bash
     cd ~/appchat/ConnectionApp/ConnectionAppBackend
     git pull origin main
     docker compose -f docker-compose.production.yml up -d --build backend
     # Wait for backend healthcheck
     sleep 15
     # Cleanup old Docker images
     docker image prune -f
     ```

### Required GitHub Secrets
| Secret | Description | Example |
|--------|-------------|---------|
| `EC2_HOST` | EC2 public IP or DNS | `54.123.45.67` |
| `EC2_USER` | SSH username | `ubuntu` |
| `EC2_SSH_KEY` | SSH private key (PEM format) | `-----BEGIN OPENSSH PRIVATE KEY-----...` |

### Error Handling
- If `git pull` fails → workflow fails, no deploy
- If `docker compose up` fails → workflow fails, old container remains running
- No automatic rollback (manual intervention required)

## Security Considerations
- SSH key stored as GitHub secret (encrypted at rest)
- No password authentication, key-only SSH
- `EC2_SSH_KNOWN_HOSTS` not required — `appleboy/ssh-action` supports `disable_host_key_verification: true`
- `.env` file stays on EC2, never committed or transferred

## Future Improvements
- Add health check verification after deploy (curl `/actuator/health`)
- Add Slack/Discord notification on success/failure
- Add rollback capability (keep previous image tag)
- Add integration test stage before deploy
- Add web/mobile CI/CD pipelines
