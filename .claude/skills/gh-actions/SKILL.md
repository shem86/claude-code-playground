---
name: gh-actions
description: Configure and troubleshoot GitHub Actions integration with Claude Code. Use when setting up claude.yml workflows, configuring MCP servers, debugging action runs, or optimizing Claude Code permissions and tools.
---

# GitHub Actions + Claude Code Integration Skill

Help configure, optimize, and troubleshoot GitHub Actions workflows that use the `anthropics/claude-code-action`.

## Common Tasks

### 1. Review Current Configuration

When invoked without arguments or with "review", analyze the current `.github/workflows/claude.yml` file:

- Check for required permissions (contents, pull-requests, issues, id-token, actions)
- Validate MCP server configurations
- Review allowed/disallowed tools
- Check system prompt configuration
- Identify potential issues or optimizations

### 2. Add MCP Server

When invoked with "add-mcp [server-name]", help add an MCP server to the workflow:

**Common MCP servers:**

- `playwright` - Browser automation for testing web apps
- `filesystem` - Advanced file operations
- `github` - GitHub API integration
- `git` - Git operations
- `sqlite` - Database operations
- `memory` - Persistent memory across runs

**Template for adding MCP:**

```yaml
--mcp-config '{"mcpServers":{"SERVER_NAME":{"command":"COMMAND","args":["ARG1","ARG2"]}}}'
```

### 3. Configure Tools

When invoked with "configure-tools", help optimize the allowed/disallowed tools list:

**Tool categories:**

- Core: `Read`, `Edit`, `Write`, `Bash`
- Search: `Glob`, `Grep`
- Web: `WebFetch`, `WebSearch`
- Tasks: `Task`, `AskUserQuestion`
- MCP: `mcp__*` prefixed tools

**Best practices:**

- Use `Bash(pattern:*)` for restricted bash commands
- Allow specific MCP tools rather than all tools
- Disallow `WebSearch` if not needed to reduce costs
- Always allow `Read`, `Edit`, `Write` for basic operations

### 4. Setup Project-Specific Configuration

When invoked with "setup", create or update the workflow for this project:

**Key considerations:**

- What dependencies need to be installed?
- Does the project need a database setup?
- Should a dev server be running?
- What artifacts should be uploaded?
- Which tools are essential for this project?

### 5. Debug Action Failures

When invoked with "debug" or "troubleshoot", help diagnose workflow issues:

**Common issues:**

- Missing permissions
- MCP server configuration errors
- Tool restrictions too tight
- System prompt issues
- Artifact upload problems
- Token/secret configuration

**Debug commands:**

```bash
# View recent workflow runs
gh run list --workflow=claude.yml --limit 5

# View specific run logs
gh run view RUN_ID --log

# View workflow file
cat .github/workflows/claude.yml
```

## Configuration Templates

### Minimal Configuration

```yaml
- name: Run Claude Code
  uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

### With MCP and Tools

```yaml
- name: Run Claude Code
  uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    claude_args: |
      --mcp-config '{"mcpServers":{"playwright":{"command":"npx","args":["@playwright/mcp@latest"]}}}'
      --allowed-tools Read,Edit,Write,Bash(npm:*)
      --system-prompt "The dev server runs at http://localhost:3000"
```

### With Artifacts

```yaml
- name: Run Claude Code
  uses: anthropics/claude-code-action@v1
  with:
    claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
    claude_args: |
      --system-prompt "Save all test artifacts to ./artifacts/ for upload"

- name: Upload artifacts
  uses: actions/upload-artifact@v4
  with:
    name: test-results
    path: ./artifacts/
```

## Best Practices

1. **Permissions**: Use minimal required permissions
   - `contents: read` - Read code
   - `pull-requests: write` - Comment on PRs
   - `issues: write` - Comment on issues
   - `id-token: write` - Required for action
   - `actions: read` - View CI results

2. **System Prompts**: Include critical context
   - Running services and URLs
   - Pre-installed dependencies
   - Log file locations
   - Artifact upload instructions

3. **Tool Restrictions**: Balance security and functionality
   - Allow necessary tools for the task
   - Use patterns like `Bash(npm:*)` for specific commands
   - Disallow dangerous operations by default

4. **MCP Servers**: Only enable what you need
   - Each MCP server adds overhead
   - Configure allowed origins for security
   - Test locally first with `claude --mcp-config`

5. **Triggers**: Choose appropriate events
   - `issue_comment` - Comments on issues/PRs
   - `pull_request_review` - PR reviews
   - `issues` - Issue creation
   - Use `contains()` to filter for @claude mentions

## Workflow Steps

The typical GitHub Actions workflow structure:

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
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup (project-specific)
        run: |
          # Install deps, start services, etc.

      - name: Run Claude Code
        uses: anthropics/claude-code-action@v1
        with:
          claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
          claude_args: |
            # Configuration here

      - name: Upload artifacts (optional)
        uses: actions/upload-artifact@v4
        with:
          name: artifacts
          path: ./artifacts/
```

## Arguments Reference

When invoked with specific arguments:

- `$0` or `$ARGUMENTS[0]` - First argument (action: review, add-mcp, setup, debug)
- `$1` or `$ARGUMENTS[1]` - Second argument (e.g., server name for add-mcp)

## Supporting Files

This skill includes additional resources:

- [templates.md](./references/templates.md) - Complete workflow templates for different scenarios (minimal, full-featured, read-only, frontend testing, backend, monorepo, etc.)
- [examples.md](./references/examples.md) - Real-world examples with explanations (React/Next.js, Python FastAPI, monorepos, code review, maintenance tasks, database apps, docs generation, issue triage)
- [troubleshooting.md](./references/troubleshooting.md) - Common errors and solutions (permissions, MCP servers, tools, secrets, timeouts, debugging)

Load these files when you need:

- Complete workflow templates to copy and customize
- Real-world examples for specific tech stacks
- Detailed configuration patterns
- Help debugging workflow failures

## Resources

- [Claude Code Action Docs](https://github.com/anthropics/claude-code-action)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)
- [GitHub Actions Permissions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#permissions-for-the-github_token)

## Current Session Context

Session ID: ${CLAUDE_SESSION_ID}

When debugging, reference this session ID in logs or artifacts.
