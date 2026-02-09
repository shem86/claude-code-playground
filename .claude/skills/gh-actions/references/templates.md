# GitHub Actions Workflow Templates

## Full-Featured Template

Complete workflow with all common features:

```yaml
name: Claude Code

on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  issues:
    types: [opened, assigned]
  pull_request_review:
    types: [submitted]

jobs:
  claude:
    # Only run when @claude is mentioned
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review_comment' && contains(github.event.comment.body, '@claude')) ||
      (github.event_name == 'pull_request_review' && contains(github.event.review.body, '@claude')) ||
      (github.event_name == 'issues' && (contains(github.event.issue.body, '@claude') || contains(github.event.issue.title, '@claude')))

    runs-on: ubuntu-latest

    permissions:
      contents: read         # Read repository code
      pull-requests: write   # Comment on PRs
      issues: write          # Comment on issues
      id-token: write        # Required for action
      actions: read          # Read CI results

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1  # Shallow clone for speed

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup database
        run: |
          npm run db:migrate
          npm run db:seed

      - name: Start dev server
        run: |
          npm run dev &
          # Wait for server to be ready
          npx wait-on http://localhost:3000

      - name: Run Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --mcp-config '{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest","--allowed-origins","localhost:3000"]}}}'
            --allowed-tools Edit,Read,Write,Bash(npm:*),Bash(sqlite3:*),mcp__playwright__*
            --disallowedTools WebSearch
            --system-prompt "Dev server: http://localhost:3000. Logs: logs.txt. Save artifacts to ./artifacts/"

      - name: Upload artifacts
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: claude-artifacts
          path: ./artifacts/
          retention-days: 7
```

## Minimal Template

Simplest possible configuration:

```yaml
name: Claude Code

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

    steps:
      - uses: actions/checkout@v4

      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

## Read-Only Template

For testing without allowing Claude to make changes:

```yaml
name: Claude Code (Read-Only)

on:
  issue_comment:
    types: [created]

jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
    runs-on: ubuntu-latest

    permissions:
      contents: read
      pull-requests: write  # Can comment but not push
      issues: write
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          use_sticky_comment: true  # Updates same comment
          claude_args: |
            --allowed-tools Read,Grep,Glob,Bash(npm test),Bash(npm run lint)
            --system-prompt "Read-only mode: analyze and suggest changes but don't modify files"
```

## Frontend Testing Template

With Playwright for UI testing:

```yaml
name: Claude Code - Frontend Testing

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

      - name: Install and build
        run: |
          npm ci
          npm run build

      - name: Start server in background
        run: |
          npm start &
          npx wait-on http://localhost:3000

      - name: Run Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --mcp-config '{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest","--allowed-origins","localhost:3000"]}}}'
            --allowed-tools Edit,Read,Write,mcp__playwright__*
            --system-prompt "Frontend app at http://localhost:3000. Use Playwright to test UI. Save screenshots to ./artifacts/"

      - name: Upload screenshots
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: screenshots
          path: ./artifacts/
```

## Backend API Template

For API testing and development:

```yaml
name: Claude Code - API Development

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
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: testdb
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

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
        run: |
          npm ci
          npm run migrate
          npm run dev &
          npx wait-on http://localhost:3000/api/health

      - name: Run Claude Code
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools Edit,Read,Write,Bash(npm:*),Bash(curl:*),Bash(psql:*)
            --system-prompt "API: http://localhost:3000. DB: postgres@localhost:5432/testdb. Test with curl or psql."
```

## Multi-Step Setup Template

For complex project setup:

```yaml
name: Claude Code

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

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Full project setup
        run: |
          # Frontend
          cd frontend
          npm ci
          npm run build

          # Backend
          cd ../backend
          pip install -r requirements.txt
          python manage.py migrate

          # Start services
          cd ..
          ./scripts/start-all.sh &

          # Wait for readiness
          npx wait-on http://localhost:3000
          npx wait-on http://localhost:8000/health

      - name: Run Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools Edit,Read,Write,Bash(npm:*),Bash(python:*),Bash(pytest:*)
            --system-prompt "Frontend: :3000, Backend: :8000. Logs in ./logs/. Full stack is running."
```

## Conditional MCP Template

Different tools based on trigger:

```yaml
name: Claude Code

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

      - name: Setup for testing
        if: contains(github.event.comment.body, 'test')
        run: |
          npm ci
          npm run dev &
          npx wait-on http://localhost:3000

      - name: Run Claude Code - Testing Mode
        if: contains(github.event.comment.body, 'test')
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --mcp-config '{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"]}}}'
            --allowed-tools Edit,Read,Write,Bash(npm:*),mcp__playwright__*
            --system-prompt "Testing mode: http://localhost:3000 ready for Playwright tests"

      - name: Run Claude Code - Review Mode
        if: "!contains(github.event.comment.body, 'test')"
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            --allowed-tools Read,Grep,Glob
            --system-prompt "Review mode: read-only access for code review"
```
