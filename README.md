# Claude Code Playground

An experimental repository showcasing **GitHub Actions + Claude Code integration**, custom skill development, and automated testing workflows. Built on a base project from a Claude Code course, this repo demonstrates real-world CI/CD automation with AI-powered code assistance.

> **Purpose:** Portfolio showcase for recruiters and experimentation with Claude Code's advanced features, GitHub Actions workflows, and MCP server integrations.

---

## 🎯 My Contributions

### 1. GitHub Actions + Claude Code Integration

**What:** Automated Claude Code to run in GitHub Actions for issue/PR assistance with browser testing capabilities.

**Why:** Explore CI/CD automation with AI, demonstrate practical DevOps skills, and create a self-maintaining project where Claude can test PRs automatically.

**Where to look:**

- **Workflow:** [`.github/workflows/claude.yml`](.github/workflows/claude.yml) - Main workflow triggered by `@claude` mentions
- **Commits:** `1b581e7`, `927d597`, `b9ab5ef`, `0acc7c7`, and ~20 more refinement commits

**Key features:**

- Triggers on issue/PR comments containing `@claude`
- Automatically sets up dev server and project dependencies
- Integrates **Playwright MCP** for browser automation and testing
- Captures and uploads test artifacts (screenshots)
- Appends artifact download links to Claude's comments
- Read-only mode: Claude tests and comments but doesn't push code

### 2. Custom `gh-actions` Skill

**What:** Comprehensive Claude Code skill for managing GitHub Actions workflows.

**Why:** Streamline workflow configuration, provide templates, and enable easy troubleshooting.

**Where to look:**

- **Skill definition:** [`.claude/skills/gh-actions/SKILL.md`](.claude/skills/gh-actions/SKILL.md)
- **Supporting docs:** Templates, examples, and troubleshooting guides in the same folder
- **Commit:** `1b581e7`

**Capabilities:**

- Review and optimize workflow configurations
- Add/configure MCP servers (Playwright, SQLite, etc.)
- Debug action failures with common error patterns
- Provide project-specific setup templates

### 3. Testing & Quality Improvements

**What:** Added tests and improved component reliability.

**Where to look:**

- Toggle button tests: `src/components/ui/__tests__/` (commit `187044f`)
- Playwright configuration for automated browser testing

---

## 🧪 Base Project: UIGen

This project inherits **UIGen**, an AI-powered React component generator from a Claude Code course. While not my primary work, it provides a functioning web app for testing the GitHub Actions integration.

<!-- markdownlint-disable MD033 -->
<details>
<summary><b>View UIGen details & setup instructions</b></summary>

### Features

- AI-powered component generation using Claude
- Live preview with hot reload
- Virtual file system (no files written to disk)
- Component persistence for registered users

### Prerequisites

- Node.js 18+
- npm

### Setup

1. **Optional:** Add Anthropic API key to `.env`:

   ```bash
   ANTHROPIC_API_KEY=your-api-key-here
   ```

   *(The app runs without it using mock data)*

2. Install and initialize:

   ```bash
   npm run setup
   ```

### Running the App

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Tech Stack

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma + SQLite
- Anthropic Claude API
- Vercel AI SDK

</details>
<!-- markdownlint-enable MD033 -->

---

## 🔍 What Makes This Interesting

1. **Real CI/CD Automation:** Claude Code runs as a GitHub Action, not just locally
2. **MCP Integration:** Demonstrates Playwright MCP for automated browser testing in CI
3. **Artifact Management:** Screenshots and test results automatically uploaded and linked
4. **Custom Tooling:** Built a reusable skill other developers could use
5. **Iterative Development:** 20+ commits refining the workflow show problem-solving process

---

## 📊 Project Stats

- **Language:** TypeScript (Next.js/React)
- **Lines Changed:** ~1500+ across GitHub Actions, skills, and testing
- **Key Technologies:** GitHub Actions, Claude Code, Playwright MCP, SQLite
- **Workflow Triggers:** Issue comments, PR reviews, issue creation

---

## 🚀 Try It Yourself

1. Open an issue in this repo
2. Mention `@claude` with a request (e.g., "@claude test the login flow")
3. Watch Claude Code run in GitHub Actions
4. See test results and screenshots posted automatically

---

## 📝 Notes

- This is a **public portfolio project** for showcasing skills to recruiters
- Focus is on the **GitHub Actions integration**, not the base UIGen app
- Demonstrates practical DevOps, CI/CD, and AI tooling experience
