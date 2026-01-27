# Troubleshooting GitHub Actions + Claude Code

Common issues and solutions when working with Claude Code in GitHub Actions.

## Permission Errors

### Error: "Resource not accessible by integration"

**Cause:** Missing or insufficient permissions in workflow

**Solution:** Add required permissions to job:

```yaml
permissions:
  contents: read         # Required: read code
  pull-requests: write   # Required: comment on PRs
  issues: write          # Required: comment on issues
  id-token: write        # Required: action authentication
  actions: read          # Optional: read CI results
```

### Error: "Cannot create pull request"

**Cause:** `contents: read` doesn't allow pushing branches

**Solution:** Change to `contents: write`:

```yaml
permissions:
  contents: write  # Allows creating branches/PRs
```

## MCP Server Errors

### Error: "MCP server failed to start"

**Cause:** Invalid JSON in `--mcp-config`

**Solution:** Validate JSON structure:

```yaml
# ❌ Wrong (missing quotes)
--mcp-config '{mcpServers:{playwright:{command:npx}}}'

# ✅ Correct (proper JSON)
--mcp-config '{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"]}}}'
```

**Debug tip:** Test locally first:
```bash
claude --mcp-config '{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"]}}}'
```

### Error: "Browser not found" (Playwright)

**Cause:** Playwright browsers not installed

**Solution:** Install browsers before running Claude:

```yaml
- name: Install Playwright browsers
  run: npx playwright install chromium

- name: Run Claude Code
  uses: anthropics/claude-code-action@v1
  # ...
```

### Error: "Connection refused" (Playwright)

**Cause:** MCP server trying to connect to unauthorized origin

**Solution:** Add allowed origins:

```yaml
--mcp-config '{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest","--allowed-origins","localhost:3000;example.com"]}}}'
```

## Tool Access Errors

### Error: "Tool X is not allowed"

**Cause:** Tool not in `--allowed-tools` list

**Solution:** Add the tool:

```yaml
# Allow specific tool
--allowed-tools Edit,Read,Write,Bash(npm:*)

# Allow all MCP Playwright tools
--allowed-tools Edit,Read,Write,mcp__playwright__*
```

### Error: "Bash command denied"

**Cause:** Bash restrictions too strict

**Solution:** Use pattern matching:

```yaml
# ❌ Too strict
--allowed-tools Bash

# ✅ Allow specific commands
--allowed-tools Bash(npm:*),Bash(git:*),Bash(curl:*)
```

**Available patterns:**
- `Bash` - Allow all bash commands (dangerous!)
- `Bash(npm:*)` - Allow all npm commands
- `Bash(git status)` - Allow only `git status`
- `Bash(npm run test)` - Allow only `npm run test`

## Server/Service Issues

### Error: "Connection refused" to localhost

**Cause:** Server not ready when Claude starts

**Solution:** Wait for server to be ready:

```yaml
- name: Start dev server
  run: |
    npm run dev &
    npx wait-on http://localhost:3000  # Wait for server
    npx wait-on --timeout 60000 http://localhost:3000  # With timeout
```

**Alternative:** Use sleep (less reliable):
```yaml
run: |
  npm run dev &
  sleep 10  # Wait 10 seconds
```

### Error: "Port already in use"

**Cause:** Multiple services trying to use same port

**Solution:** Use different ports or kill existing processes:

```yaml
- name: Clean up ports
  run: |
    lsof -ti:3000 | xargs kill -9 || true  # Kill process on 3000
    npm run dev &
```

### Error: "Database connection failed"

**Cause:** Database service not ready

**Solution:** Use health checks:

```yaml
services:
  postgres:
    image: postgres:15
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

## Secret/Token Issues

### Error: "Invalid token" or "Unauthorized"

**Cause:** Missing or incorrect `CLAUDE_CODE_OAUTH_TOKEN`

**Solution:**
1. Get token from Claude Code settings
2. Add as repository secret
3. Reference in workflow:

```yaml
claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

**Verify secret exists:**
```bash
gh secret list
gh secret set CLAUDE_CODE_OAUTH_TOKEN < token.txt
```

### Error: "Secret not found"

**Cause:** Secret not available in forked PRs

**Solution:** Secrets are not available in PRs from forks by default (security feature). Options:

1. Only run on push events:
```yaml
on:
  push:
    branches: [main]
```

2. Use `pull_request_target` (be careful!):
```yaml
on:
  pull_request_target:  # Has access to secrets but runs on base branch
```

## Timeout Issues

### Error: "Job timed out"

**Cause:** Default 6-hour timeout too short or infinite loop

**Solution:** Set custom timeout:

```yaml
jobs:
  claude:
    timeout-minutes: 30  # Fail after 30 minutes
```

### Error: "Task taking too long"

**Cause:** Complex task without progress updates

**Solution:** Use `track_progress` mode:

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    track_progress: true  # Enables tracking comments
```

## Workflow Trigger Issues

### Claude doesn't respond to @mentions

**Cause:** Workflow condition too strict

**Solution:** Check if condition matches event:

```yaml
# Make sure condition matches the event
jobs:
  claude:
    if: contains(github.event.comment.body, '@claude')
```

**Debug tip:** Check what triggered the workflow:
```yaml
- name: Debug event
  run: |
    echo "Event: ${{ github.event_name }}"
    echo "Comment: ${{ github.event.comment.body }}"
```

### Workflow doesn't trigger at all

**Cause:** Event type not in `on:` section

**Solution:** Add all event types:

```yaml
on:
  issue_comment:           # Comments on issues
    types: [created]
  pull_request_review_comment:  # Comments on PR files
    types: [created]
  pull_request_review:     # PR reviews
    types: [submitted]
  issues:                  # Issue creation
    types: [opened]
```

## Artifact Issues

### Error: "No artifacts found"

**Cause:** Path doesn't exist or Claude didn't create artifacts

**Solution:** Use `if: always()` and check path:

```yaml
- name: Upload artifacts
  if: always()  # Run even if previous steps failed
  uses: actions/upload-artifact@v4
  with:
    name: artifacts
    path: ./artifacts/
    if-no-files-found: warn  # Don't fail if no files
```

**Debug tip:** List directory contents:
```yaml
- name: Check artifacts
  if: always()
  run: ls -la ./artifacts/ || echo "No artifacts directory"
```

## Claude-Specific Issues

### Claude makes unwanted changes

**Cause:** System prompt unclear or missing restrictions

**Solution:** Be explicit in system prompt:

```yaml
--system-prompt "DO NOT modify files. Read-only analysis. Comment with findings."
```

### Claude can't find files

**Cause:** Working directory or repository structure

**Solution:**
1. Ensure checkout is complete:
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Full history
```

2. Provide context in system prompt:
```yaml
--system-prompt "Project structure: src/ contains source, tests/ contains tests."
```

### Claude output too verbose

**Cause:** Default commenting mode

**Solution:** Use sticky comments:

```yaml
- uses: anthropics/claude-code-action@v1
  with:
    use_sticky_comment: true  # Update same comment
```

## Debugging Workflows

### View recent runs

```bash
gh run list --workflow=claude.yml --limit 10
```

### View specific run logs

```bash
gh run view RUN_ID --log
gh run view RUN_ID --log-failed  # Only failed steps
```

### Download artifacts

```bash
gh run download RUN_ID
gh run download RUN_ID --name screenshots
```

### Re-run failed workflow

```bash
gh run rerun RUN_ID
gh run rerun RUN_ID --failed  # Only failed jobs
```

### Test workflow locally

Use [act](https://github.com/nektos/act) to run workflows locally:

```bash
# Install act
brew install act

# Run workflow
act -j claude --secret CLAUDE_CODE_OAUTH_TOKEN=your-token

# Dry run
act -j claude --dryrun
```

## Performance Optimization

### Slow checkout

**Problem:** Large repository takes too long

**Solution:** Shallow clone:

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 1  # Only latest commit
```

### Slow dependency installation

**Problem:** Installing dependencies every time

**Solution:** Use caching:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'  # Cache npm dependencies

- uses: actions/cache@v4
  with:
    path: ~/.cache
    key: ${{ runner.os }}-cache-${{ hashFiles('package-lock.json') }}
```

### Too many tool calls

**Problem:** Claude making excessive API calls

**Solution:**
1. Use `disallowedTools` to block expensive operations:
```yaml
--disallowedTools WebSearch  # Prevent web searches
```

2. Reduce context with focused system prompt:
```yaml
--system-prompt "Focus only on the auth module in src/auth/"
```

## Getting Help

If you're still stuck:

1. **Check workflow run logs:** `gh run view RUN_ID --log`
2. **Review Claude Code docs:** https://code.claude.com/docs
3. **Check action docs:** https://github.com/anthropics/claude-code-action
4. **Search issues:** https://github.com/anthropics/claude-code/issues
5. **Ask in the issue/PR:** Claude can help debug its own configuration!
