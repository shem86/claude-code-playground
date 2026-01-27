# GitHub Actions Examples

Real-world examples of Claude Code GitHub Actions configurations.

## Example 1: React/Next.js App with Playwright

**Use case:** Testing a Next.js application with live preview

```yaml
name: Claude Code

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]

jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest

    permissions:
      contents: read
      pull-requests: write
      issues: write
      id-token: write
      actions: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup and start dev server
        run: |
          npm ci
          npm run dev &
          npx wait-on http://localhost:3000

      - name: Run Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --mcp-config '{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest","--allowed-origins","localhost:3000;cdn.tailwindcss.com"]}}}'
            --allowed-tools Edit,Read,Write,Bash(npm:*),mcp__playwright__*
            --disallowedTools WebSearch
            --system-prompt "Dev server at http://localhost:3000. Use Playwright to test UI changes. Save screenshots to ./artifacts/"

      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: test-artifacts
          path: ./artifacts/
```

**What it does:**
- Starts Next.js dev server on port 3000
- Gives Claude access to Playwright for browser testing
- Allows Claude to run npm commands and edit files
- Uploads screenshots and other artifacts
- Prevents web searches to reduce costs

## Example 2: Python FastAPI Backend

**Use case:** API development with database migrations

```yaml
name: Claude Code - Backend

on:
  issue_comment:
    types: [created]

jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: app_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    permissions:
      contents: read
      pull-requests: write
      issues: write
      id-token: write
      actions: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install and setup
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/app_db
        run: |
          pip install -r requirements.txt
          alembic upgrade head
          uvicorn main:app --host 0.0.0.0 --port 8000 &
          sleep 5  # Wait for API to be ready

      - name: Run Claude Code
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/app_db
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools Edit,Read,Write,Bash(python:*),Bash(pytest:*),Bash(alembic:*),Bash(curl:*)
            --system-prompt "API running at http://localhost:8000. Postgres at localhost:5432. Test endpoints with curl or pytest."
```

**What it does:**
- Spins up PostgreSQL as a service
- Runs database migrations
- Starts FastAPI server
- Allows Claude to run Python, pytest, alembic, and curl commands
- Provides database connection info

## Example 3: Monorepo with Multiple Services

**Use case:** Full-stack monorepo with frontend and backend

```yaml
name: Claude Code - Monorepo

on:
  issue_comment:
    types: [created]

jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest
    timeout-minutes: 30

    permissions:
      contents: read
      pull-requests: write
      issues: write
      id-token: write
      actions: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies (all packages)
        run: |
          npm ci
          npm run build:packages

      - name: Start all services
        run: |
          # Start backend
          cd packages/backend
          npm start &

          # Start frontend
          cd ../frontend
          npm run dev &

          # Start docs
          cd ../docs
          npm run dev &

          # Wait for all services
          cd ../..
          npx wait-on http://localhost:3000 http://localhost:8000 http://localhost:3001

      - name: Run Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools Edit,Read,Write,Bash(npm:*),Bash(turbo:*)
            --system-prompt "Monorepo structure: packages/frontend (:3000), packages/backend (:8000), packages/docs (:3001). Use turbo for builds."
```

**What it does:**
- Installs dependencies for entire monorepo
- Builds shared packages
- Starts multiple services on different ports
- Allows turborepo commands
- Provides clear service mapping

## Example 4: Read-Only Code Review

**Use case:** Let Claude review code without making changes

```yaml
name: Claude Code Review

on:
  pull_request_review:
    types: [submitted]

jobs:
  claude-review:
    if: contains(github.event.review.body, '@claude')
    runs-on: ubuntu-latest

    permissions:
      contents: read
      pull-requests: write
      id-token: write

    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Run Claude Code in Review Mode
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          use_sticky_comment: true  # Update same comment
          claude_args: |
            --allowed-tools Read,Grep,Glob,Bash(git diff)
            --system-prompt "Code review mode. Analyze the PR changes and provide feedback. Do not modify files."
```

**What it does:**
- Triggers on PR review comments
- Read-only access (no Edit or Write)
- Uses sticky comments to avoid spam
- Checks out the PR branch
- Only allows reading and searching code

## Example 5: Scheduled Maintenance Tasks

**Use case:** Daily codebase health checks

```yaml
name: Claude Maintenance

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9 AM
  workflow_dispatch:  # Manual trigger

jobs:
  maintenance:
    runs-on: ubuntu-latest

    permissions:
      contents: write  # Can create commits
      pull-requests: write
      issues: write
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run maintenance checks
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools Edit,Read,Write,Bash(npm:*)
            --system-prompt "Weekly maintenance: Update dependencies, check for deprecated APIs, run security audit. Create a PR with fixes."
```

**What it does:**
- Runs automatically every Monday
- Can also be triggered manually
- Has write permissions to create PRs
- Performs regular maintenance tasks
- Creates PRs instead of direct commits

## Example 6: Database-Heavy Application

**Use case:** SQLite database with migrations and seeding

```yaml
name: Claude Code - Database App

on:
  issue_comment:
    types: [created]

jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest

    permissions:
      contents: read
      pull-requests: write
      issues: write
      id-token: write
      actions: read

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup database and server
        run: |
          npm ci
          npx prisma generate
          npx prisma migrate deploy
          npx prisma db seed
          npm run dev &
          npx wait-on http://localhost:3000

      - name: Run Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools Edit,Read,Write,Bash(npm:*),Bash(sqlite3:*),Bash(prisma:*)
            --system-prompt "App at :3000. SQLite DB ready with seed data. Use sqlite3 CLI or Prisma for queries."

      - name: Save database state
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: database
          path: prisma/dev.db
```

**What it does:**
- Generates Prisma client
- Runs migrations
- Seeds test data
- Allows sqlite3 and Prisma commands
- Saves database as artifact for inspection

## Example 7: Documentation Generation

**Use case:** Automatically update docs

```yaml
name: Claude Docs

on:
  push:
    branches: [main]
    paths:
      - 'src/**'
      - 'lib/**'
  workflow_dispatch:

jobs:
  update-docs:
    runs-on: ubuntu-latest

    permissions:
      contents: write
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Generate documentation
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools Read,Write,Bash(git:*)
            --system-prompt "Update docs/ based on recent code changes. Add examples for new features. Commit and push changes."

      - name: Deploy docs
        run: npm run docs:deploy
```

**What it does:**
- Triggers on code changes
- Has write permissions
- Reads new code and updates docs
- Commits documentation updates
- Deploys updated docs

## Example 8: Issue Triage and Labeling

**Use case:** Automatically categorize and label issues

```yaml
name: Claude Issue Triage

on:
  issues:
    types: [opened]

jobs:
  triage:
    runs-on: ubuntu-latest

    permissions:
      issues: write
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - name: Triage issue
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools Read,Grep,Bash(gh issue edit)
            --system-prompt "Analyze issue #${{ github.event.issue.number }}. Search codebase for relevant code. Add appropriate labels (bug/feature/docs). Suggest which team should handle it."
```

**What it does:**
- Triggers automatically on new issues
- Searches codebase for context
- Adds appropriate labels
- Suggests team assignment
- Comments with initial analysis
