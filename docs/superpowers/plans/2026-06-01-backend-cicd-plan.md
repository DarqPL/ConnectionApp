# Backend CI/CD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a GitHub Actions workflow that automatically deploys ConnectionAppBackend to EC2 on push to `main`.

**Architecture:** Two-job pipeline: (1) Build verification on GitHub runner, (2) SSH deploy to EC2 via `appleboy/ssh-action` that pulls latest code and rebuilds the backend container.

**Tech Stack:** GitHub Actions, Spring Boot 3.5, Java 21, Maven, Docker Compose, SSH

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `.github/workflows/backend-deploy.yml` | Create | GitHub Actions workflow definition |
| `ConnectionAppBackend/.gitignore` | Modify | Ensure `.env` and sensitive files are excluded |

---

### Task 1: Create GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/backend-deploy.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/backend-deploy.yml` with the following content:

```yaml
name: Backend Deploy

on:
  push:
    branches: [main]
    paths:
      - "ConnectionAppBackend/**"

jobs:
  build:
    name: Build & Verify
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ConnectionAppBackend
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Java 21
        uses: actions/setup-java@v4
        with:
          java-version: "21"
          distribution: "temurin"
          cache: maven

      - name: Build with Maven
        run: ./mvnw clean package -DskipTests -B

  deploy:
    name: Deploy to EC2
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: SSH and Deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          disable_host_key_verification: true
          script: |
            cd ~/appchat/ConnectionApp/ConnectionAppBackend
            git pull origin main
            docker compose -f docker-compose.production.yml up -d --build backend
            sleep 15
            docker image prune -f
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/backend-deploy.yml
git commit -m "ci: add backend deploy workflow"
```

---

### Task 2: Verify .gitignore Excludes Sensitive Files

**Files:**
- Read: `ConnectionAppBackend/.gitignore`

- [ ] **Step 1: Read current .gitignore**

Read `ConnectionAppBackend/.gitignore` and verify it contains at minimum:

```
.env
*.class
target/
.mvn/wrapper/maven-wrapper.jar
```

- [ ] **Step 2: Update if needed**

If `.env` is not already excluded, add it:

```
.env
```

- [ ] **Step 3: Commit**

```bash
git add ConnectionAppBackend/.gitignore
git commit -m "chore: ensure .env is gitignored"
```

---

### Task 3: Document Setup Instructions

**Files:**
- Read: `AGENTS.md`

- [ ] **Step 1: Add CI/CD setup section to AGENTS.md**

Append to `AGENTS.md` under a new `## CI/CD Setup` section:

```markdown
## CI/CD Setup

Backend auto-deploys to EC2 on push to `main` via GitHub Actions.

### Required GitHub Repository Secrets

Configure these in Settings → Secrets and variables → Actions:

| Secret | Description | Example |
|--------|-------------|---------|
| `EC2_HOST` | EC2 public IP or DNS | `54.123.45.67` |
| `EC2_USER` | SSH username | `ubuntu` |
| `EC2_SSH_KEY` | SSH private key (PEM) | Content of `.pem` file |

### EC2 Prerequisites

- SSH key-based authentication enabled for the deploy user
- Docker and Docker Compose installed
- Repository cloned to `~/appchat/ConnectionApp/`
- `.env` file configured in `ConnectionAppBackend/`
- User has `docker` group membership (no sudo required for docker commands)

### Triggering Deploy

Push to `main` with changes in `ConnectionAppBackend/**`:
```bash
git push origin main
```

### Manual Deploy

Run workflow manually from GitHub Actions tab → "Backend Deploy" → "Run workflow".
```

- [ ] **Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs: add CI/CD setup instructions to AGENTS.md"
```
