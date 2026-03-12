# IsItSlop MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working IsItSlop MVP — paste a GitHub repo URL, get a Slop Score with snarky verdict and fix prompts, shareable via static URL.

**Architecture:** Next.js 15 frontend on Vercel talks to a Python scoring service on Modal via async webhook. Supabase stores analysis results. Frontend creates a pending record, fires webhook, polls until complete, renders result page. Scoring is deterministic; GPT-4.1-mini writes verdicts only.

**Tech Stack:** Next.js 15 (App Router), TailwindCSS, Supabase (Postgres), Python on Modal, OpenAI GPT-4.1-mini

---

## Chunk 1: Foundation — Next.js + Supabase + Types

> **Reviewer fixes applied:** Migration moved before API route (was Task 20, now Task 4.5). Python test infra added to Task 6. `analyzed_at` bug fixed. Lock file detection fixed. Polling timeout added. Rate limit tests added. OG image deferred to post-MVP. Task 11 kept bundled (analyzers follow identical pattern).

### Task 1: Next.js Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.gitignore`, `.env.local.example`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /Users/chrisgscott/projects/scratch/isitslop
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --turbopack
```

Accept defaults. This creates the full scaffold.

- [ ] **Step 2: Verify dev server starts**

Run: `pnpm dev`
Expected: Dev server starts on localhost:3000, default Next.js page renders.
Kill the server after confirming.

- [ ] **Step 3: Create .env.local.example**

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MODAL_WEBHOOK_URL=your-modal-webhook-url
MODAL_WEBHOOK_SECRET=your-webhook-secret
```

- [ ] **Step 4: Add .env.local.example to .gitignore check**

Verify `.env.local` is in `.gitignore` (Next.js adds it by default). Add `.env` if missing.

- [ ] **Step 5: Install additional dependencies**

```bash
pnpm add @supabase/supabase-js nanoid
pnpm add -D @types/node
```

- [ ] **Step 6: Commit**

```bash
git init
git add -A
git commit -m "feat: initialize Next.js 15 project with Tailwind"
```

---

### Task 2: Shared Analysis Types

**Files:**
- Create: `src/types/analysis.ts`

- [ ] **Step 1: Define analysis types**

```typescript
// src/types/analysis.ts

export type AnalysisStatus = 'pending' | 'analyzing' | 'complete' | 'error';

export type DimensionKey =
  | 'error_handling'
  | 'test_coverage'
  | 'documentation'
  | 'security'
  | 'code_structure'
  | 'dependencies';

export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface DimensionScore {
  score: number; // 0-100
  grade: LetterGrade;
  findings_count: number;
}

export type DimensionScores = Record<DimensionKey, DimensionScore>;

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface Finding {
  dimension: DimensionKey;
  severity: FindingSeverity;
  file: string | null;
  line: number | null;
  issue: string;
  evidence: string;
  fix_prompt: string;
}

export interface AnalysisMetadata {
  total_files: number;
  total_loc: number;
  languages: Record<string, number>;
  primary_language: string;
  has_package_json: boolean;
  dep_count: number;
  dev_dep_count: number;
  repo_size_mb: number;
  analysis_duration_ms: number;
}

export interface Analysis {
  id: string;
  repo_url: string;
  repo_owner: string;
  repo_name: string;
  repo_branch: string | null;
  status: AnalysisStatus;
  slop_score: number | null;
  scores: DimensionScores | null;
  verdict: string | null;
  receipts: Finding[] | null;
  metadata: AnalysisMetadata | null;
  error_message: string | null;
  analyzed_at: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/analysis.ts
git commit -m "feat: add shared analysis types"
```

---

### Task 3: GitHub URL Parser

**Files:**
- Create: `src/lib/github.ts`
- Create: `src/lib/__tests__/github.test.ts`

- [ ] **Step 1: Install vitest**

```bash
pnpm add -D vitest @vitejs/plugin-react
```

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

Add to `package.json` scripts: `"test": "vitest run", "test:watch": "vitest"`

- [ ] **Step 2: Write failing tests**

```typescript
// src/lib/__tests__/github.test.ts
import { parseGitHubUrl, type GitHubRepo } from '@/lib/github'

describe('parseGitHubUrl', () => {
  it('parses full https URL', () => {
    const result = parseGitHubUrl('https://github.com/vercel/next.js')
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js', branch: null })
  })

  it('parses URL without protocol', () => {
    const result = parseGitHubUrl('github.com/vercel/next.js')
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js', branch: null })
  })

  it('parses owner/repo shorthand', () => {
    const result = parseGitHubUrl('vercel/next.js')
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js', branch: null })
  })

  it('parses URL with trailing slash', () => {
    const result = parseGitHubUrl('https://github.com/vercel/next.js/')
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js', branch: null })
  })

  it('parses URL with .git suffix', () => {
    const result = parseGitHubUrl('https://github.com/vercel/next.js.git')
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js', branch: null })
  })

  it('parses URL with branch path', () => {
    const result = parseGitHubUrl('https://github.com/vercel/next.js/tree/canary')
    expect(result).toEqual({ owner: 'vercel', repo: 'next.js', branch: 'canary' })
  })

  it('returns null for invalid URL', () => {
    expect(parseGitHubUrl('not-a-url')).toBeNull()
    expect(parseGitHubUrl('https://gitlab.com/foo/bar')).toBeNull()
    expect(parseGitHubUrl('')).toBeNull()
    expect(parseGitHubUrl('https://github.com/')).toBeNull()
    expect(parseGitHubUrl('https://github.com/just-owner')).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test`
Expected: FAIL — `parseGitHubUrl` not found.

- [ ] **Step 4: Implement GitHub URL parser**

```typescript
// src/lib/github.ts

export interface GitHubRepo {
  owner: string
  repo: string
  branch: string | null
}

export function parseGitHubUrl(input: string): GitHubRepo | null {
  if (!input || !input.trim()) return null

  let cleaned = input.trim()

  // Try owner/repo shorthand first (no dots, no slashes beyond the one)
  const shorthandMatch = cleaned.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shorthandMatch && !cleaned.includes('.')) {
    return { owner: shorthandMatch[1], repo: shorthandMatch[2], branch: null }
  }

  // Normalize: add protocol if missing
  if (!cleaned.startsWith('http')) {
    cleaned = 'https://' + cleaned
  }

  let url: URL
  try {
    url = new URL(cleaned)
  } catch {
    return null
  }

  // Must be github.com
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    return null
  }

  // Parse path: /owner/repo[/tree/branch]
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null

  const owner = parts[0]
  let repo = parts[1].replace(/\.git$/, '')
  let branch: string | null = null

  // Check for /tree/branch pattern
  if (parts.length >= 4 && parts[2] === 'tree') {
    branch = parts.slice(3).join('/')
  }

  return { owner, repo, branch }
}

export function buildTarballUrl(repo: GitHubRepo): string {
  const ref = repo.branch || ''
  return `https://api.github.com/repos/${repo.owner}/${repo.repo}/tarball/${ref}`
}

export function buildRepoUrl(repo: GitHubRepo): string {
  return `https://github.com/${repo.owner}/${repo.repo}`
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/github.ts src/lib/__tests__/github.test.ts vitest.config.ts
git commit -m "feat: add GitHub URL parser with tests"
```

---

### Task 4: Supabase Client Setup

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Create browser client**

```typescript
// src/lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] **Step 2: Create server client (service role for API routes)**

```typescript
// src/lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js'

export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createClient(supabaseUrl, serviceRoleKey)
}
```

- [ ] **Step 3: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat: add Supabase client setup"
```

---

### Task 4.5: Supabase Migration

**Files:**
- Create: `supabase/migrations/001_create_analyses.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- supabase/migrations/001_create_analyses.sql

create table public.analyses (
  id text primary key,
  repo_url text not null,
  repo_owner text not null,
  repo_name text not null,
  repo_branch text,
  status text not null default 'pending' check (status in ('pending', 'analyzing', 'complete', 'error')),
  slop_score integer check (slop_score >= 0 and slop_score <= 100),
  scores jsonb,
  verdict text,
  receipts jsonb,
  metadata jsonb default '{}'::jsonb,
  error_message text,
  analyzed_at timestamptz,
  created_at timestamptz default now() not null
);

create index analyses_repo_idx on public.analyses(repo_owner, repo_name);
create index analyses_status_idx on public.analyses(status) where status in ('pending', 'analyzing');
```

- [ ] **Step 2: Apply migration to Supabase**

Apply via Supabase dashboard SQL editor or CLI.

- [ ] **Step 3: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase migration for analyses table"
```

---

### Task 5: API Route — POST /api/analyze

**Files:**
- Create: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
// src/app/api/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createServiceClient } from '@/lib/supabase/server'
import { parseGitHubUrl, buildRepoUrl } from '@/lib/github'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { url } = body

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  const parsed = parseGitHubUrl(url)
  if (!parsed) {
    return NextResponse.json(
      { error: 'Invalid GitHub URL. Try formats like: owner/repo, github.com/owner/repo, or https://github.com/owner/repo' },
      { status: 400 }
    )
  }

  const id = nanoid(10)
  const supabase = createServiceClient()

  // Create pending analysis record
  const { error: insertError } = await supabase
    .from('analyses')
    .insert({
      id,
      repo_url: buildRepoUrl(parsed),
      repo_owner: parsed.owner,
      repo_name: parsed.repo,
      repo_branch: parsed.branch,
      status: 'pending',
    })

  if (insertError) {
    console.error('Failed to create analysis record:', insertError)
    return NextResponse.json({ error: 'Failed to start analysis' }, { status: 500 })
  }

  // Fire webhook to Modal (fire-and-forget)
  const webhookUrl = process.env.MODAL_WEBHOOK_URL
  if (webhookUrl) {
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MODAL_WEBHOOK_SECRET || ''}`,
      },
      body: JSON.stringify({
        analysis_id: id,
        repo_owner: parsed.owner,
        repo_name: parsed.repo,
        repo_branch: parsed.branch,
      }),
    }).catch((err) => {
      console.error('Failed to fire webhook:', err)
    })
  }

  return NextResponse.json({ id, status: 'pending' })
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/analyze/route.ts
git commit -m "feat: add POST /api/analyze route"
```

---

## Chunk 2: Scoring Service — Modal + Downloader + Scanner

### Task 6: Modal App Scaffolding

**Files:**
- Create: `scoring-service/modal_app.py`
- Create: `scoring-service/requirements.txt`
- Create: `scoring-service/.python-version`

- [ ] **Step 1: Create requirements.txt**

```
modal>=0.70.0
fastapi[standard]
openai
supabase>=2.0.0
httpx
pytest
```

- [ ] **Step 2: Create .python-version**

```
3.12
```

- [ ] **Step 3: Create Modal app with health check and webhook endpoint**

```python
# scoring-service/modal_app.py
import modal
import os

app = modal.App("isitslop-scoring")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install_from_requirements("requirements.txt")
)


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("isitslop-secrets")],
    timeout=600,
    scaledown_window=60,
)
@modal.fastapi_endpoint(method="GET")
def health():
    return {"status": "ok", "service": "isitslop-scoring"}


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("isitslop-secrets")],
    timeout=600,
    scaledown_window=60,
)
@modal.fastapi_endpoint(method="POST")
def analyze_webhook(request: dict):
    """Webhook endpoint to trigger repo analysis."""
    from tools.pipeline import run_analysis

    analysis_id = request.get("analysis_id")
    repo_owner = request.get("repo_owner")
    repo_name = request.get("repo_name")
    repo_branch = request.get("repo_branch")

    if not analysis_id or not repo_owner or not repo_name:
        return {"error": "Missing required fields"}

    try:
        run_analysis(
            analysis_id=analysis_id,
            repo_owner=repo_owner,
            repo_name=repo_name,
            repo_branch=repo_branch,
        )
        return {"status": "complete", "analysis_id": analysis_id}
    except Exception as e:
        # Update analysis status to error in Supabase
        from tools.db import update_analysis_error
        update_analysis_error(analysis_id, str(e))
        return {"status": "error", "error": str(e)}


@app.local_entrypoint()
def main():
    """Local testing entrypoint."""
    print("IsItSlop scoring service ready.")
    print("Run with: modal serve modal_app.py")
```

- [ ] **Step 4: Create db helper**

```python
# scoring-service/tools/db.py
import os
from supabase import create_client

def get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


def update_analysis_status(analysis_id: str, status: str):
    sb = get_supabase()
    sb.table("analyses").update({"status": status}).eq("id", analysis_id).execute()


def update_analysis_error(analysis_id: str, error_message: str):
    sb = get_supabase()
    sb.table("analyses").update({
        "status": "error",
        "error_message": error_message,
    }).eq("id", analysis_id).execute()


def save_analysis_results(analysis_id: str, results: dict):
    from datetime import datetime, timezone
    sb = get_supabase()
    sb.table("analyses").update({
        "status": "complete",
        "slop_score": results["slop_score"],
        "scores": results["scores"],
        "verdict": results["verdict"],
        "receipts": results["receipts"],
        "metadata": results["metadata"],
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", analysis_id).execute()
```

- [ ] **Step 5: Create tools/__init__.py and test infrastructure**

```python
# scoring-service/tools/__init__.py
```

```python
# scoring-service/tests/__init__.py
```

```python
# scoring-service/conftest.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
```

- [ ] **Step 5.5: Set up Python environment and install deps**

```bash
cd scoring-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

- [ ] **Step 6: Commit**

```bash
git add scoring-service/
git commit -m "feat: scaffold Modal scoring service with webhook endpoint"
```

---

### Task 7: Repo Downloader

**Files:**
- Create: `scoring-service/tools/repo_downloader.py`
- Create: `scoring-service/tests/test_repo_downloader.py`

- [ ] **Step 1: Write failing test**

```python
# scoring-service/tests/test_repo_downloader.py
import pytest
from tools.repo_downloader import download_and_extract, RepoTooLargeError

def test_download_small_public_repo():
    """Test downloading a known small public repo."""
    path = download_and_extract("octocat", "Hello-World", branch=None)
    assert path.exists()
    assert (path / "README").exists() or any(path.iterdir())

def test_download_nonexistent_repo():
    """Test error handling for nonexistent repo."""
    with pytest.raises(Exception):
        download_and_extract("nonexistent-user-xyz", "nonexistent-repo-xyz", branch=None)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scoring-service && python -m pytest tests/test_repo_downloader.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement repo downloader**

```python
# scoring-service/tools/repo_downloader.py
import httpx
import tarfile
import tempfile
from pathlib import Path

MAX_TARBALL_SIZE_MB = 100
MAX_TARBALL_SIZE_BYTES = MAX_TARBALL_SIZE_MB * 1024 * 1024


class RepoTooLargeError(Exception):
    pass


class RepoNotFoundError(Exception):
    pass


class RepoPrivateError(Exception):
    pass


def download_and_extract(
    owner: str,
    repo: str,
    branch: str | None = None,
    github_token: str | None = None,
) -> Path:
    """Download a GitHub repo tarball and extract to a temp directory."""
    ref = branch or ""
    url = f"https://api.github.com/repos/{owner}/{repo}/tarball/{ref}"

    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "IsItSlop/1.0",
    }
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"

    with httpx.stream("GET", url, headers=headers, follow_redirects=True, timeout=60.0) as response:
        if response.status_code == 404:
            raise RepoNotFoundError(f"Repository {owner}/{repo} not found")
        if response.status_code == 403:
            raise RepoPrivateError(f"Repository {owner}/{repo} is private or rate limited")
        response.raise_for_status()

        # Check content-length if available
        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > MAX_TARBALL_SIZE_BYTES:
            raise RepoTooLargeError(
                f"Repository is too large ({int(content_length) / 1024 / 1024:.0f}MB). Max: {MAX_TARBALL_SIZE_MB}MB."
            )

        # Download to temp file
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".tar.gz")
        downloaded = 0
        for chunk in response.iter_bytes(chunk_size=8192):
            downloaded += len(chunk)
            if downloaded > MAX_TARBALL_SIZE_BYTES:
                tmp.close()
                Path(tmp.name).unlink()
                raise RepoTooLargeError(f"Repository exceeds {MAX_TARBALL_SIZE_MB}MB limit.")
            tmp.write(chunk)
        tmp.close()

    # Extract tarball
    extract_dir = Path(tempfile.mkdtemp(prefix="isitslop-"))
    with tarfile.open(tmp.name, "r:gz") as tar:
        tar.extractall(path=extract_dir, filter="data")

    # Clean up tarball
    Path(tmp.name).unlink()

    # GitHub tarballs extract to a single directory like owner-repo-sha/
    # Return the inner directory
    subdirs = list(extract_dir.iterdir())
    if len(subdirs) == 1 and subdirs[0].is_dir():
        return subdirs[0]
    return extract_dir
```

- [ ] **Step 4: Run tests**

Run: `cd scoring-service && python -m pytest tests/test_repo_downloader.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scoring-service/tools/repo_downloader.py scoring-service/tests/
git commit -m "feat: add repo downloader with tarball extraction"
```

---

### Task 8: File Scanner

**Files:**
- Create: `scoring-service/tools/file_scanner.py`
- Create: `scoring-service/tests/test_file_scanner.py`

- [ ] **Step 1: Write failing test**

```python
# scoring-service/tests/test_file_scanner.py
import pytest
import tempfile
from pathlib import Path
from tools.file_scanner import scan_repo, ScannedFile, ScanResult

@pytest.fixture
def sample_repo(tmp_path):
    """Create a minimal repo structure for testing."""
    # Source files
    src = tmp_path / "src"
    src.mkdir()
    (src / "index.ts").write_text("console.log('hello');\nconsole.log('world');\n")
    (src / "utils.ts").write_text("export function add(a: number, b: number) { return a + b; }\n")

    # Test file
    tests = tmp_path / "tests"
    tests.mkdir()
    (tests / "index.test.ts").write_text("test('it works', () => { expect(true).toBe(true); });\n")

    # package.json
    (tmp_path / "package.json").write_text('{"name":"test","scripts":{"test":"vitest"},"dependencies":{"react":"^18.0.0"},"devDependencies":{"vitest":"^1.0.0"}}')

    # README
    (tmp_path / "README.md").write_text("# Test Project\nA test project.\n")

    # Should be skipped
    nm = tmp_path / "node_modules" / "react"
    nm.mkdir(parents=True)
    (nm / "index.js").write_text("module.exports = {};")

    return tmp_path


def test_scan_counts_files(sample_repo):
    result = scan_repo(sample_repo)
    # Should NOT include node_modules
    assert result.total_files == 5  # index.ts, utils.ts, index.test.ts, package.json, README.md


def test_scan_counts_loc(sample_repo):
    result = scan_repo(sample_repo)
    assert result.total_loc > 0


def test_scan_detects_languages(sample_repo):
    result = scan_repo(sample_repo)
    assert "typescript" in result.languages


def test_scan_detects_test_files(sample_repo):
    result = scan_repo(sample_repo)
    test_files = [f for f in result.files if f.is_test]
    assert len(test_files) == 1


def test_scan_skips_node_modules(sample_repo):
    result = scan_repo(sample_repo)
    paths = [str(f.path) for f in result.files]
    assert not any("node_modules" in p for p in paths)


def test_scan_reads_package_json(sample_repo):
    result = scan_repo(sample_repo)
    assert result.package_json is not None
    assert result.package_json["name"] == "test"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scoring-service && python -m pytest tests/test_file_scanner.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement file scanner**

```python
# scoring-service/tools/file_scanner.py
import json
from dataclasses import dataclass, field
from pathlib import Path

SKIP_DIRS = {
    "node_modules", "dist", "build", ".next", "vendor", "__pycache__",
    ".git", ".svn", ".hg", "coverage", ".nyc_output", ".cache",
    ".turbo", ".vercel", ".netlify", "out", "target", "bin", "obj",
    ".tox", ".mypy_cache", ".pytest_cache", "venv", ".venv", "env",
}

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".bmp", ".webp",
    ".woff", ".woff2", ".ttf", ".eot", ".otf",
    ".mp3", ".mp4", ".wav", ".avi", ".mov",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",
    ".pyc", ".pyo", ".so", ".dll", ".dylib", ".exe",
}

# Lock files to detect (not skip) — checked separately for dependency analysis
LOCK_FILES = {"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb"}

LANGUAGE_MAP = {
    ".ts": "typescript", ".tsx": "typescript",
    ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".py": "python",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".cpp": "cpp", ".cc": "cpp", ".c": "c", ".h": "c",
    ".swift": "swift",
    ".kt": "kotlin",
    ".css": "css", ".scss": "scss", ".less": "less",
    ".html": "html", ".htm": "html",
    ".json": "json",
    ".yaml": "yaml", ".yml": "yaml",
    ".md": "markdown",
    ".sql": "sql",
    ".sh": "shell", ".bash": "shell", ".zsh": "shell",
}

TEST_PATTERNS = {
    ".test.", ".spec.", "_test.", "_spec.",
    "test_", "spec_",
}

MAX_FILES = 10_000


@dataclass
class ScannedFile:
    path: str  # Relative to repo root
    extension: str
    language: str | None
    loc: int
    content: str
    is_test: bool


@dataclass
class ScanResult:
    files: list[ScannedFile] = field(default_factory=list)
    total_files: int = 0
    total_loc: int = 0
    languages: dict[str, float] = field(default_factory=dict)  # language -> proportion
    primary_language: str = "unknown"
    package_json: dict | None = None
    has_readme: bool = False
    readme_content: str = ""
    has_lock_file: bool = False


def _is_test_file(path: str) -> bool:
    name = Path(path).name.lower()
    parent = Path(path).parent.name.lower()
    if parent in {"test", "tests", "__tests__", "spec", "specs"}:
        return True
    return any(pattern in name for pattern in TEST_PATTERNS)


def scan_repo(repo_path: Path) -> ScanResult:
    """Single-pass walk of the repo, collecting all metrics."""
    result = ScanResult()
    lang_loc: dict[str, int] = {}

    for item in _walk_files(repo_path):
        if result.total_files >= MAX_FILES:
            break

        rel_path = str(item.relative_to(repo_path))
        ext = item.suffix.lower()

        # Skip binaries
        if ext in BINARY_EXTENSIONS:
            continue

        # Try to read file
        try:
            content = item.read_text(errors="ignore")
        except (OSError, UnicodeDecodeError):
            continue

        loc = len(content.splitlines())
        language = LANGUAGE_MAP.get(ext)
        is_test = _is_test_file(rel_path)

        # Track package.json
        if item.name == "package.json" and item.parent == repo_path:
            try:
                result.package_json = json.loads(content)
            except json.JSONDecodeError:
                pass

        # Track lock files
        if item.name in LOCK_FILES:
            result.has_lock_file = True

        # Track README
        if item.name.lower().startswith("readme"):
            result.has_readme = True
            result.readme_content = content

        scanned = ScannedFile(
            path=rel_path,
            extension=ext,
            language=language,
            loc=loc,
            content=content,
            is_test=is_test,
        )
        result.files.append(scanned)
        result.total_files += 1
        result.total_loc += loc

        if language:
            lang_loc[language] = lang_loc.get(language, 0) + loc

    # Calculate language proportions
    total_code_loc = sum(lang_loc.values()) or 1
    result.languages = {
        lang: round(loc / total_code_loc, 2)
        for lang, loc in sorted(lang_loc.items(), key=lambda x: -x[1])
    }
    if result.languages:
        result.primary_language = next(iter(result.languages))

    return result


def _walk_files(root: Path):
    """Walk directory tree, skipping ignored directories."""
    try:
        entries = sorted(root.iterdir())
    except PermissionError:
        return

    for entry in entries:
        if entry.is_dir():
            if entry.name in SKIP_DIRS or entry.name.startswith("."):
                continue
            yield from _walk_files(entry)
        elif entry.is_file():
            yield entry
```

- [ ] **Step 4: Run tests**

Run: `cd scoring-service && python -m pytest tests/test_file_scanner.py -v`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scoring-service/tools/file_scanner.py scoring-service/tests/test_file_scanner.py
git commit -m "feat: add single-pass file scanner"
```

---

## Chunk 3: Analyzers

### Task 9: Error Handling Analyzer

**Files:**
- Create: `scoring-service/tools/analyzers/__init__.py`
- Create: `scoring-service/tools/analyzers/error_handling.py`
- Create: `scoring-service/tests/test_analyzers.py`

- [ ] **Step 1: Write failing test**

```python
# scoring-service/tests/test_analyzers.py
import pytest
from tools.file_scanner import ScannedFile
from tools.analyzers.error_handling import analyze_error_handling

def _make_file(path: str, content: str, ext: str = ".ts") -> ScannedFile:
    return ScannedFile(
        path=path, extension=ext, language="typescript",
        loc=len(content.splitlines()), content=content, is_test=False,
    )

class TestErrorHandling:
    def test_detects_empty_catch(self):
        file = _make_file("app.ts", "try { foo() } catch (e) { }")
        findings = analyze_error_handling([file])
        issues = [f["issue"] for f in findings]
        assert any("empty catch" in i.lower() for i in issues)

    def test_detects_console_log_density(self):
        content = "\n".join([f"console.log('line {i}')" for i in range(10)])
        file = _make_file("app.ts", content)
        findings = analyze_error_handling([file])
        issues = [f["issue"] for f in findings]
        assert any("console.log" in i.lower() for i in issues)

    def test_no_findings_for_clean_code(self):
        file = _make_file("app.ts", "export function add(a, b) { return a + b; }")
        findings = analyze_error_handling([file])
        assert len(findings) == 0

    def test_skips_test_files(self):
        file = ScannedFile(
            path="app.test.ts", extension=".ts", language="typescript",
            loc=1, content="try { foo() } catch (e) { }", is_test=True,
        )
        findings = analyze_error_handling([file])
        assert len(findings) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py::TestErrorHandling -v`
Expected: FAIL.

- [ ] **Step 3: Implement error handling analyzer**

```python
# scoring-service/tools/analyzers/__init__.py
```

```python
# scoring-service/tools/analyzers/error_handling.py
import re
from tools.file_scanner import ScannedFile

# Patterns to detect
EMPTY_CATCH = re.compile(r'catch\s*\([^)]*\)\s*\{\s*\}', re.MULTILINE)
CATCH_ONLY_CONSOLE = re.compile(r'catch\s*\([^)]*\)\s*\{\s*console\.(log|warn)\([^)]*\)\s*;?\s*\}', re.MULTILINE)
CONSOLE_LOG = re.compile(r'\bconsole\.log\b')
UNHANDLED_PROMISE = re.compile(r'\.then\([^)]*\)\s*(?!\.catch)', re.MULTILINE)

CONSOLE_LOG_THRESHOLD = 5  # per file


def analyze_error_handling(files: list[ScannedFile]) -> list[dict]:
    findings = []

    for file in files:
        if file.is_test or not file.language:
            continue

        lines = file.content.splitlines()

        # Empty catch blocks
        for match in EMPTY_CATCH.finditer(file.content):
            line_num = file.content[:match.start()].count('\n') + 1
            findings.append({
                "dimension": "error_handling",
                "severity": "high",
                "file": file.path,
                "line": line_num,
                "issue": "Empty catch block swallows errors silently",
                "evidence": match.group().strip()[:100],
                "fix_prompt": f"In {file.path} at line {line_num}, there's an empty catch block. Add proper error handling — log the error and either re-throw or return an appropriate error response.",
            })

        # Catch blocks that only console.log
        for match in CATCH_ONLY_CONSOLE.finditer(file.content):
            line_num = file.content[:match.start()].count('\n') + 1
            findings.append({
                "dimension": "error_handling",
                "severity": "medium",
                "file": file.path,
                "line": line_num,
                "issue": "Catch block only logs error without handling it",
                "evidence": match.group().strip()[:100],
                "fix_prompt": f"In {file.path} at line {line_num}, the catch block only console.logs the error. Add proper error handling — return an error response, show a user-facing message, or re-throw.",
            })

        # Console.log density (non-test files)
        console_count = len(CONSOLE_LOG.findall(file.content))
        if console_count >= CONSOLE_LOG_THRESHOLD:
            findings.append({
                "dimension": "error_handling",
                "severity": "medium",
                "file": file.path,
                "line": None,
                "issue": f"High console.log density ({console_count} instances) — likely debug code left in production",
                "evidence": f"{console_count} console.log calls in {file.loc} lines",
                "fix_prompt": f"In {file.path}, there are {console_count} console.log statements. Replace with a proper logging library or remove debug logs before shipping.",
            })

    return findings
```

- [ ] **Step 4: Run tests**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py::TestErrorHandling -v`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add scoring-service/tools/analyzers/ scoring-service/tests/test_analyzers.py
git commit -m "feat: add error handling analyzer"
```

---

### Task 10: Test Coverage Analyzer

**Files:**
- Create: `scoring-service/tools/analyzers/test_coverage.py`
- Modify: `scoring-service/tests/test_analyzers.py`

- [ ] **Step 1: Write failing tests**

Append to `scoring-service/tests/test_analyzers.py`:

```python
from tools.analyzers.test_coverage import analyze_test_coverage
from tools.file_scanner import ScanResult

class TestTestCoverage:
    def test_detects_no_tests(self):
        files = [_make_file("app.ts", "const x = 1;")]
        result = ScanResult(files=files, total_files=1, total_loc=1, package_json={"scripts": {}})
        findings = analyze_test_coverage(result)
        assert any("no test" in f["issue"].lower() for f in findings)

    def test_detects_no_test_script(self):
        files = [_make_file("app.ts", "const x = 1;")]
        result = ScanResult(files=files, total_files=1, total_loc=1, package_json={"scripts": {"start": "node app.js"}})
        findings = analyze_test_coverage(result)
        assert any("test script" in f["issue"].lower() for f in findings)

    def test_detects_low_test_ratio(self):
        source_files = [_make_file(f"src/file{i}.ts", "const x = 1;\n" * 50) for i in range(10)]
        test_files = [ScannedFile(path="test/one.test.ts", extension=".ts", language="typescript", loc=5, content="test('x', () => {})", is_test=True)]
        result = ScanResult(files=source_files + test_files, total_files=11, total_loc=505, package_json={"scripts": {"test": "vitest"}})
        findings = analyze_test_coverage(result)
        assert any("ratio" in f["issue"].lower() for f in findings)

    def test_clean_project_no_critical(self):
        source_files = [_make_file(f"src/file{i}.ts", "const x = 1;\n" * 10) for i in range(3)]
        test_files = [ScannedFile(path=f"test/file{i}.test.ts", extension=".ts", language="typescript", loc=10, content="test('x', () => {})", is_test=True) for i in range(3)]
        result = ScanResult(files=source_files + test_files, total_files=6, total_loc=60, package_json={"scripts": {"test": "vitest"}})
        findings = analyze_test_coverage(result)
        critical = [f for f in findings if f["severity"] == "critical"]
        assert len(critical) == 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py::TestTestCoverage -v`
Expected: FAIL.

- [ ] **Step 3: Implement test coverage analyzer**

```python
# scoring-service/tools/analyzers/test_coverage.py
from tools.file_scanner import ScanResult


def analyze_test_coverage(scan: ScanResult) -> list[dict]:
    findings = []

    test_files = [f for f in scan.files if f.is_test]
    source_files = [f for f in scan.files if not f.is_test and f.language and f.extension not in {".json", ".md", ".yaml", ".yml", ".css", ".scss", ".html"}]

    # No tests at all
    if len(test_files) == 0 and len(source_files) > 0:
        findings.append({
            "dimension": "test_coverage",
            "severity": "critical",
            "file": None,
            "line": None,
            "issue": "No test files found anywhere in the repository",
            "evidence": f"0 files matching *.test.*, *.spec.*, or test directory ({len(source_files)} source files)",
            "fix_prompt": f"This project has zero tests across {len(source_files)} source files. Add a test framework and write tests for the core business logic.",
        })

    # No test script in package.json
    pkg = scan.package_json
    if pkg:
        scripts = pkg.get("scripts", {})
        has_test_script = any(k in scripts for k in ["test", "test:unit", "test:e2e", "test:integration"])
        if not has_test_script:
            findings.append({
                "dimension": "test_coverage",
                "severity": "high",
                "file": "package.json",
                "line": None,
                "issue": "No test script defined in package.json",
                "evidence": f"scripts: {list(scripts.keys())}",
                "fix_prompt": "Add a test script to package.json. Example: \"test\": \"vitest\" or \"test\": \"jest\".",
            })

    # Low test-to-source ratio
    if len(test_files) > 0 and len(source_files) > 0:
        test_loc = sum(f.loc for f in test_files)
        source_loc = sum(f.loc for f in source_files)
        ratio = test_loc / source_loc if source_loc > 0 else 0

        if ratio < 0.1:
            findings.append({
                "dimension": "test_coverage",
                "severity": "high",
                "file": None,
                "line": None,
                "issue": f"Very low test-to-source ratio ({ratio:.1%}) — tests are {test_loc} LOC vs {source_loc} LOC source",
                "evidence": f"{len(test_files)} test files, {len(source_files)} source files, ratio: {ratio:.1%}",
                "fix_prompt": f"Test coverage is very thin ({ratio:.1%} test-to-source ratio). Add tests for the most critical paths first.",
            })
        elif ratio < 0.3:
            findings.append({
                "dimension": "test_coverage",
                "severity": "medium",
                "file": None,
                "line": None,
                "issue": f"Low test-to-source ratio ({ratio:.1%})",
                "evidence": f"{len(test_files)} test files, {len(source_files)} source files",
                "fix_prompt": f"Test coverage is below average ({ratio:.1%}). Consider adding more test coverage, especially for edge cases.",
            })

    return findings
```

- [ ] **Step 4: Run tests**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py::TestTestCoverage -v`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add scoring-service/tools/analyzers/test_coverage.py scoring-service/tests/test_analyzers.py
git commit -m "feat: add test coverage analyzer"
```

---

### Task 11: Remaining Analyzers (Documentation, Security, Code Structure, Dependencies)

**Files:**
- Create: `scoring-service/tools/analyzers/documentation.py`
- Create: `scoring-service/tools/analyzers/security.py`
- Create: `scoring-service/tools/analyzers/code_structure.py`
- Create: `scoring-service/tools/analyzers/dependencies.py`
- Modify: `scoring-service/tests/test_analyzers.py`

This task creates the remaining 4 analyzers. Each follows the same pattern: takes files/scan result, returns a list of finding dicts.

- [ ] **Step 1: Write tests for all 4 analyzers**

Append to `scoring-service/tests/test_analyzers.py`:

```python
from tools.analyzers.documentation import analyze_documentation
from tools.analyzers.security import analyze_security
from tools.analyzers.code_structure import analyze_code_structure
from tools.analyzers.dependencies import analyze_dependencies

class TestDocumentation:
    def test_detects_no_readme(self):
        result = ScanResult(files=[], total_files=1, total_loc=100, has_readme=False, readme_content="")
        findings = analyze_documentation(result)
        assert any("readme" in f["issue"].lower() for f in findings)

    def test_detects_empty_readme(self):
        result = ScanResult(files=[], total_files=1, total_loc=100, has_readme=True, readme_content="# My Project\n")
        findings = analyze_documentation(result)
        assert any("thin" in f["issue"].lower() or "short" in f["issue"].lower() for f in findings)

class TestSecurity:
    def test_detects_hardcoded_secrets(self):
        file = _make_file("config.ts", 'const API_KEY = "sk-1234567890abcdef1234567890abcdef"')
        findings = analyze_security([file])
        assert any("secret" in f["issue"].lower() or "key" in f["issue"].lower() for f in findings)

    def test_detects_env_file(self):
        file = _make_file(".env", "API_KEY=secret123", ext="")
        findings = analyze_security([file])
        assert any(".env" in f["issue"].lower() for f in findings)

    def test_no_findings_for_clean_code(self):
        file = _make_file("app.ts", "const x = process.env.API_KEY;")
        findings = analyze_security([file])
        assert len(findings) == 0

class TestCodeStructure:
    def test_detects_god_file(self):
        content = "\n".join([f"const line{i} = {i};" for i in range(500)])
        file = _make_file("god.ts", content)
        findings = analyze_code_structure([file])
        assert any("large" in f["issue"].lower() or "god" in f["issue"].lower() for f in findings)

    def test_detects_deep_nesting(self):
        content = "if (a) {\n  if (b) {\n    if (c) {\n      if (d) {\n        if (e) {\n          x();\n        }\n      }\n    }\n  }\n}"
        file = _make_file("nested.ts", content)
        findings = analyze_code_structure([file])
        assert any("nest" in f["issue"].lower() for f in findings)

class TestDependencies:
    def test_detects_too_many_deps(self):
        deps = {f"dep-{i}": "^1.0.0" for i in range(50)}
        pkg = {"dependencies": deps, "devDependencies": {}}
        findings = analyze_dependencies(pkg, total_loc=500)
        assert any("dependencies" in f["issue"].lower() for f in findings)

    def test_detects_missing_lock_file(self):
        pkg = {"dependencies": {"react": "^18.0.0"}}
        files = [_make_file("package.json", "{}")]
        findings = analyze_dependencies(pkg, total_loc=100, has_lock_file=False)
        assert any("lock" in f["issue"].lower() for f in findings)

    def test_detects_duplicate_purpose(self):
        pkg = {"dependencies": {"axios": "^1.0.0", "node-fetch": "^3.0.0"}, "devDependencies": {}}
        findings = analyze_dependencies(pkg, total_loc=100)
        assert any("duplicate" in f["issue"].lower() for f in findings)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py -v -k "TestDocumentation or TestSecurity or TestCodeStructure or TestDependencies"`
Expected: FAIL.

- [ ] **Step 3: Implement documentation analyzer**

```python
# scoring-service/tools/analyzers/documentation.py
from tools.file_scanner import ScanResult


def analyze_documentation(scan: ScanResult) -> list[dict]:
    findings = []

    if not scan.has_readme:
        findings.append({
            "dimension": "documentation",
            "severity": "high",
            "file": None,
            "line": None,
            "issue": "No README file found",
            "evidence": "Missing README.md",
            "fix_prompt": "Add a README.md with at least: project description, setup instructions, and usage examples.",
        })
    elif len(scan.readme_content.strip().splitlines()) < 5:
        findings.append({
            "dimension": "documentation",
            "severity": "medium",
            "file": "README.md",
            "line": None,
            "issue": "README is very short/thin — likely auto-generated or placeholder",
            "evidence": f"{len(scan.readme_content.strip().splitlines())} lines",
            "fix_prompt": "Your README is basically empty. Add: what this project does, how to install it, how to run it, and how to use it.",
        })

    # Check for inline documentation in source files
    source_files = [f for f in scan.files if not f.is_test and f.language and f.language not in {"json", "yaml", "markdown", "css", "html"}]

    if source_files:
        total_loc = sum(f.loc for f in source_files)
        comment_lines = 0
        for f in source_files:
            for line in f.content.splitlines():
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("/*") or stripped.startswith("*") or stripped.startswith("'''") or stripped.startswith('"""'):
                    comment_lines += 1

        comment_ratio = comment_lines / total_loc if total_loc > 0 else 0
        if comment_ratio < 0.02 and total_loc > 200:
            findings.append({
                "dimension": "documentation",
                "severity": "low",
                "file": None,
                "line": None,
                "issue": f"Very few inline comments ({comment_ratio:.1%} of code)",
                "evidence": f"{comment_lines} comment lines in {total_loc} LOC",
                "fix_prompt": "Add comments to explain non-obvious logic, especially in complex functions and business rules.",
            })

    return findings
```

- [ ] **Step 4: Implement security analyzer**

```python
# scoring-service/tools/analyzers/security.py
import re
from tools.file_scanner import ScannedFile

# Patterns for hardcoded secrets
SECRET_PATTERNS = [
    (re.compile(r'''(?:api[_-]?key|apikey|secret[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)\s*[:=]\s*["\']([a-zA-Z0-9_\-/+=]{20,})["\']''', re.IGNORECASE), "Hardcoded API key or secret"),
    (re.compile(r'''["\']sk-[a-zA-Z0-9]{20,}["\']'''), "OpenAI API key"),
    (re.compile(r'''["\']ghp_[a-zA-Z0-9]{36,}["\']'''), "GitHub personal access token"),
    (re.compile(r'''["\']AKIA[A-Z0-9]{16}["\']'''), "AWS access key"),
    (re.compile(r'''password\s*[:=]\s*["\'](?!.*\{\{)(?!.*process\.env)(?!.*os\.environ)([^"\']{8,})["\']''', re.IGNORECASE), "Hardcoded password"),
]


def analyze_security(files: list[ScannedFile]) -> list[dict]:
    findings = []

    for file in files:
        if file.is_test:
            continue

        # Check for .env files committed
        if file.path == ".env" or file.path.endswith("/.env"):
            findings.append({
                "dimension": "security",
                "severity": "critical",
                "file": file.path,
                "line": None,
                "issue": ".env file committed to repository — may contain secrets",
                "evidence": ".env file found in repo",
                "fix_prompt": f"Remove {file.path} from the repository and add .env to .gitignore. Rotate any secrets that were exposed.",
            })
            continue

        # Check for hardcoded secrets
        for pattern, description in SECRET_PATTERNS:
            for match in pattern.finditer(file.content):
                line_num = file.content[:match.start()].count('\n') + 1
                # Mask the actual secret
                evidence = match.group()[:30] + "..." if len(match.group()) > 30 else match.group()
                findings.append({
                    "dimension": "security",
                    "severity": "critical",
                    "file": file.path,
                    "line": line_num,
                    "issue": f"{description} found in source code",
                    "evidence": evidence,
                    "fix_prompt": f"In {file.path} at line {line_num}, there's a hardcoded secret. Move it to an environment variable and add the file to .gitignore if needed.",
                })

    return findings
```

- [ ] **Step 5: Implement code structure analyzer**

```python
# scoring-service/tools/analyzers/code_structure.py
import re
from tools.file_scanner import ScannedFile

GOD_FILE_THRESHOLD = 400  # LOC
DEEP_NESTING_THRESHOLD = 4  # levels
LONG_FUNCTION_THRESHOLD = 80  # lines


def analyze_code_structure(files: list[ScannedFile]) -> list[dict]:
    findings = []

    for file in files:
        if file.is_test or not file.language:
            continue

        # God files
        if file.loc > GOD_FILE_THRESHOLD:
            findings.append({
                "dimension": "code_structure",
                "severity": "high",
                "file": file.path,
                "line": None,
                "issue": f"Large file ({file.loc} lines) — likely doing too much",
                "evidence": f"{file.loc} LOC, threshold is {GOD_FILE_THRESHOLD}",
                "fix_prompt": f"{file.path} is {file.loc} lines long. Break it into smaller, focused modules. Each file should have one clear responsibility.",
            })

        # Deep nesting detection (count indent levels)
        max_depth = _detect_max_nesting(file.content)
        if max_depth >= DEEP_NESTING_THRESHOLD:
            findings.append({
                "dimension": "code_structure",
                "severity": "medium",
                "file": file.path,
                "line": None,
                "issue": f"Deep nesting detected ({max_depth} levels) — hard to read and maintain",
                "evidence": f"Max nesting depth: {max_depth}",
                "fix_prompt": f"{file.path} has {max_depth} levels of nesting. Use early returns, extract helper functions, or restructure conditionals to flatten the code.",
            })

    # Duplicate-named files (utils.js + utils2.js pattern)
    name_counts: dict[str, list[str]] = {}
    for file in files:
        if file.is_test:
            continue
        base = re.sub(r'\d+', '', file.path.split('/')[-1].rsplit('.', 1)[0]).lower()
        if base:
            name_counts.setdefault(base, []).append(file.path)

    for base_name, paths in name_counts.items():
        if len(paths) > 2 and base_name not in {"index", "page", "layout", "route", "loading", "error"}:
            findings.append({
                "dimension": "code_structure",
                "severity": "low",
                "file": None,
                "line": None,
                "issue": f"Multiple files with similar names suggesting copy-paste: {', '.join(paths[:3])}",
                "evidence": f"{len(paths)} files with base name '{base_name}'",
                "fix_prompt": f"There are {len(paths)} files that look like copies of each other. Consolidate them or give them meaningful, distinct names.",
            })

    return findings


def _detect_max_nesting(content: str) -> int:
    """Detect maximum brace/indent nesting depth."""
    max_depth = 0
    current_depth = 0
    for char in content:
        if char == '{':
            current_depth += 1
            max_depth = max(max_depth, current_depth)
        elif char == '}':
            current_depth = max(0, current_depth - 1)
    return max_depth
```

- [ ] **Step 6: Implement dependencies analyzer**

```python
# scoring-service/tools/analyzers/dependencies.py

DUPLICATE_PURPOSE_GROUPS = [
    ({"axios", "node-fetch", "got", "ky", "superagent", "request", "undici"}, "HTTP client"),
    ({"lodash", "underscore", "ramda"}, "utility library"),
    ({"moment", "dayjs", "date-fns", "luxon"}, "date library"),
    ({"express", "fastify", "koa", "hapi"}, "HTTP framework"),
    ({"jest", "mocha", "ava", "tap", "vitest"}, "test framework"),
    ({"winston", "pino", "bunyan", "log4js"}, "logging library"),
    ({"yup", "joi", "zod", "superstruct", "valibot"}, "validation library"),
    ({"styled-components", "emotion", "@emotion/react"}, "CSS-in-JS"),
]


def analyze_dependencies(
    package_json: dict | None,
    total_loc: int,
    has_lock_file: bool = True,
) -> list[dict]:
    if not package_json:
        return []

    findings = []
    deps = package_json.get("dependencies", {})
    dev_deps = package_json.get("devDependencies", {})
    all_dep_names = set(deps.keys()) | set(dev_deps.keys())

    # Too many dependencies relative to codebase
    dep_count = len(deps)
    if dep_count > 40:
        findings.append({
            "dimension": "dependencies",
            "severity": "high",
            "file": "package.json",
            "line": None,
            "issue": f"Excessive dependencies ({dep_count}) — possible dependency bloat",
            "evidence": f"{dep_count} production dependencies",
            "fix_prompt": f"This project has {dep_count} production dependencies. Audit them — are all of these actually used? Run `npx depcheck` to find unused packages.",
        })
    elif dep_count > 25:
        findings.append({
            "dimension": "dependencies",
            "severity": "medium",
            "file": "package.json",
            "line": None,
            "issue": f"High dependency count ({dep_count})",
            "evidence": f"{dep_count} production dependencies",
            "fix_prompt": f"Review your {dep_count} dependencies. Some may be unused or replaceable with built-in alternatives.",
        })

    # Missing lock file
    if not has_lock_file and dep_count > 0:
        findings.append({
            "dimension": "dependencies",
            "severity": "high",
            "file": None,
            "line": None,
            "issue": "No lock file found (package-lock.json, yarn.lock, or pnpm-lock.yaml)",
            "evidence": "Missing lock file",
            "fix_prompt": "Add a lock file to ensure reproducible installs. Run `npm install`, `yarn install`, or `pnpm install` to generate one.",
        })

    # Duplicate-purpose packages
    for group, purpose in DUPLICATE_PURPOSE_GROUPS:
        found = all_dep_names & group
        if len(found) > 1:
            findings.append({
                "dimension": "dependencies",
                "severity": "medium",
                "file": "package.json",
                "line": None,
                "issue": f"Duplicate-purpose packages for {purpose}: {', '.join(sorted(found))}",
                "evidence": f"Multiple {purpose} libraries installed",
                "fix_prompt": f"You have multiple {purpose} libraries installed: {', '.join(sorted(found))}. Pick one and remove the others.",
            })

    return findings
```

- [ ] **Step 7: Run all analyzer tests**

Run: `cd scoring-service && python -m pytest tests/test_analyzers.py -v`
Expected: All PASS.

- [ ] **Step 8: Commit**

```bash
git add scoring-service/tools/analyzers/ scoring-service/tests/test_analyzers.py
git commit -m "feat: add documentation, security, code structure, and dependency analyzers"
```

---

## Chunk 4: Scorer + Verdict Writer + Pipeline

### Task 12: Scorer

**Files:**
- Create: `scoring-service/tools/scorer.py`
- Create: `scoring-service/tests/test_scorer.py`

- [ ] **Step 1: Write failing tests**

```python
# scoring-service/tests/test_scorer.py
from tools.scorer import calculate_scores, calculate_composite_score, score_to_grade

def test_score_to_grade():
    assert score_to_grade(95) == "A"
    assert score_to_grade(85) == "B"
    assert score_to_grade(75) == "C"
    assert score_to_grade(65) == "D"
    assert score_to_grade(50) == "F"
    assert score_to_grade(0) == "F"
    assert score_to_grade(100) == "A"

def test_calculate_scores_from_findings():
    findings = [
        {"dimension": "error_handling", "severity": "high"},
        {"dimension": "error_handling", "severity": "medium"},
        {"dimension": "test_coverage", "severity": "critical"},
    ]
    scores = calculate_scores(findings, total_files=10, total_loc=500)
    assert "error_handling" in scores
    assert "test_coverage" in scores
    assert scores["error_handling"]["grade"] in ("A", "B", "C", "D", "F")

def test_composite_score():
    scores = {
        "error_handling": {"score": 50, "grade": "F", "findings_count": 5},
        "test_coverage": {"score": 80, "grade": "B", "findings_count": 1},
        "documentation": {"score": 90, "grade": "A", "findings_count": 0},
        "security": {"score": 100, "grade": "A", "findings_count": 0},
        "code_structure": {"score": 60, "grade": "D", "findings_count": 3},
        "dependencies": {"score": 70, "grade": "C", "findings_count": 2},
    }
    composite = calculate_composite_score(scores)
    assert 0 <= composite <= 100
    # Should be weighted toward structure (25%) and error_handling (20%)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scoring-service && python -m pytest tests/test_scorer.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement scorer**

```python
# scoring-service/tools/scorer.py

DIMENSION_WEIGHTS = {
    "error_handling": 0.20,
    "code_structure": 0.25,
    "test_coverage": 0.20,
    "security": 0.15,
    "dependencies": 0.10,
    "documentation": 0.10,
}

SEVERITY_PENALTIES = {
    "critical": 20,
    "high": 12,
    "medium": 6,
    "low": 2,
}

ALL_DIMENSIONS = list(DIMENSION_WEIGHTS.keys())


def score_to_grade(score: int) -> str:
    if score >= 90: return "A"
    if score >= 80: return "B"
    if score >= 70: return "C"
    if score >= 60: return "D"
    return "F"


def calculate_scores(findings: list[dict], total_files: int, total_loc: int) -> dict:
    """Calculate per-dimension scores from findings."""
    scores = {}

    for dim in ALL_DIMENSIONS:
        dim_findings = [f for f in findings if f["dimension"] == dim]
        # Start at 100, subtract penalties
        score = 100
        for f in dim_findings:
            severity = f.get("severity", "medium")
            penalty = SEVERITY_PENALTIES.get(severity, 5)
            score -= penalty

        # Normalize: more files = more tolerance (scale penalty by density)
        # But don't go below 0
        score = max(0, min(100, score))

        scores[dim] = {
            "score": score,
            "grade": score_to_grade(score),
            "findings_count": len(dim_findings),
        }

    return scores


def calculate_composite_score(scores: dict) -> int:
    """Weighted average of dimension scores. Higher = more slop."""
    weighted_sum = 0.0
    for dim, weight in DIMENSION_WEIGHTS.items():
        dim_score = scores.get(dim, {}).get("score", 100)
        # Invert: 100 quality = 0 slop
        slop_score = 100 - dim_score
        weighted_sum += slop_score * weight

    return round(weighted_sum)
```

- [ ] **Step 4: Run tests**

Run: `cd scoring-service && python -m pytest tests/test_scorer.py -v`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add scoring-service/tools/scorer.py scoring-service/tests/test_scorer.py
git commit -m "feat: add scorer with weighted composite calculation"
```

---

### Task 13: Verdict Writer

**Files:**
- Create: `scoring-service/tools/verdict_writer.py`
- Create: `scoring-service/tests/test_verdict_writer.py`

- [ ] **Step 1: Write failing test**

```python
# scoring-service/tests/test_verdict_writer.py
import pytest
from unittest.mock import patch, MagicMock
from tools.verdict_writer import build_verdict_prompt, parse_verdict_response

def test_build_prompt_includes_scores():
    scores = {
        "error_handling": {"score": 45, "grade": "F", "findings_count": 5},
        "test_coverage": {"score": 0, "grade": "F", "findings_count": 1},
        "documentation": {"score": 72, "grade": "C", "findings_count": 2},
        "security": {"score": 85, "grade": "B", "findings_count": 1},
        "code_structure": {"score": 38, "grade": "F", "findings_count": 8},
        "dependencies": {"score": 65, "grade": "D", "findings_count": 3},
    }
    findings = [{"dimension": "test_coverage", "severity": "critical", "issue": "No tests", "file": None}]
    prompt = build_verdict_prompt(
        repo_name="vercel/next.js",
        slop_score=72,
        scores=scores,
        findings=findings,
        metadata={"total_files": 50, "total_loc": 3000},
    )
    assert "72" in prompt
    assert "vercel/next.js" in prompt
    assert "No tests" in prompt

def test_parse_verdict_extracts_text():
    mock_response = "This repo is sloppy. Your AI phoned it in."
    result = parse_verdict_response(mock_response)
    assert isinstance(result, str)
    assert len(result) > 0
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scoring-service && python -m pytest tests/test_verdict_writer.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement verdict writer**

```python
# scoring-service/tools/verdict_writer.py
import os
import json
from openai import OpenAI

DEFAULT_MODEL = "gpt-4.1-mini"

SYSTEM_PROMPT = """You are the voice of IsItSlop — a vibe code gut check tool. You write brutally honest, specific, and funny verdicts about code quality. You're not mean, but you're not nice either. You're the friend who tells you your fly is down.

Your audience: developers who know they vibe coded something with AI and want to know how bad it is. They can take it.

Rules:
- Be specific. Reference actual files, actual counts, actual problems.
- Be funny. Not try-hard funny. Deadpan, observational funny.
- Be actionable. Every critique should be fixable.
- Keep the overall verdict to 2-4 sentences max.
- Write dimension commentary as 1-2 punchy sentences each.
- Don't be generic. "Code could be improved" is worthless. "47 console.logs in production code" is useful.
- The tone is "your AI did you dirty — here are the receipts."
- Don't congratulate them on anything unless the score is genuinely good (A or B).
"""

USER_PROMPT_TEMPLATE = """Write a verdict for this repo analysis:

**Repo:** {repo_name}
**Slop Score:** {slop_score}/100 (higher = more slop)
**Files:** {total_files} | **LOC:** {total_loc}

**Dimension Grades:**
{dimension_grades}

**Top Findings:**
{top_findings}

Write:
1. An overall verdict (2-4 sentences, punchy)
2. One-liner commentary for each of the 6 dimensions

Format as plain text. Start with the verdict, then list each dimension on its own line as "**Dimension Name:** commentary"."""


def build_verdict_prompt(
    repo_name: str,
    slop_score: int,
    scores: dict,
    findings: list[dict],
    metadata: dict,
) -> str:
    dimension_grades = "\n".join([
        f"- {dim}: {data['grade']} ({data['score']}/100, {data['findings_count']} issues)"
        for dim, data in scores.items()
    ])

    # Top 10 most severe findings
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    sorted_findings = sorted(findings, key=lambda f: severity_order.get(f.get("severity", "low"), 4))
    top = sorted_findings[:10]

    top_findings = "\n".join([
        f"- [{f.get('severity', 'medium').upper()}] {f['issue']}" + (f" ({f['file']})" if f.get('file') else "")
        for f in top
    ])

    return USER_PROMPT_TEMPLATE.format(
        repo_name=repo_name,
        slop_score=slop_score,
        total_files=metadata.get("total_files", "?"),
        total_loc=metadata.get("total_loc", "?"),
        dimension_grades=dimension_grades,
        top_findings=top_findings or "No significant findings.",
    )


def parse_verdict_response(response_text: str) -> str:
    return response_text.strip()


def generate_verdict(
    repo_name: str,
    slop_score: int,
    scores: dict,
    findings: list[dict],
    metadata: dict,
    model: str | None = None,
) -> str:
    """Call OpenAI to generate the snarky verdict."""
    client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    prompt = build_verdict_prompt(repo_name, slop_score, scores, findings, metadata)

    response = client.chat.completions.create(
        model=model or DEFAULT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.9,
        max_tokens=1000,
    )

    return parse_verdict_response(response.choices[0].message.content)
```

- [ ] **Step 4: Run tests**

Run: `cd scoring-service && python -m pytest tests/test_verdict_writer.py -v`
Expected: All PASS (only tests that don't call OpenAI).

- [ ] **Step 5: Commit**

```bash
git add scoring-service/tools/verdict_writer.py scoring-service/tests/test_verdict_writer.py
git commit -m "feat: add verdict writer with OpenAI GPT-4.1-mini integration"
```

---

### Task 14: Analysis Pipeline

**Files:**
- Create: `scoring-service/tools/pipeline.py`
- Create: `scoring-service/tests/test_pipeline.py`

- [ ] **Step 1: Write integration test (mocked OpenAI)**

```python
# scoring-service/tests/test_pipeline.py
import pytest
from unittest.mock import patch, MagicMock
from tools.pipeline import analyze_repo

@patch("tools.verdict_writer.OpenAI")
@patch("tools.db.get_supabase")
def test_analyze_repo_returns_results(mock_supabase, mock_openai):
    """Test full pipeline with a small public repo, mocking OpenAI and Supabase."""
    # Mock OpenAI response
    mock_client = MagicMock()
    mock_openai.return_value = mock_client
    mock_response = MagicMock()
    mock_response.choices = [MagicMock(message=MagicMock(content="This repo is sloppy."))]
    mock_client.chat.completions.create.return_value = mock_response

    # Mock Supabase
    mock_sb = MagicMock()
    mock_supabase.return_value = mock_sb

    results = analyze_repo(
        repo_owner="octocat",
        repo_name="Hello-World",
        repo_branch=None,
    )

    assert "slop_score" in results
    assert 0 <= results["slop_score"] <= 100
    assert "scores" in results
    assert "verdict" in results
    assert "receipts" in results
    assert "metadata" in results
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scoring-service && python -m pytest tests/test_pipeline.py -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement pipeline**

```python
# scoring-service/tools/pipeline.py
import os
import time
import shutil
from pathlib import Path

from tools.repo_downloader import download_and_extract
from tools.file_scanner import scan_repo
from tools.analyzers.error_handling import analyze_error_handling
from tools.analyzers.test_coverage import analyze_test_coverage
from tools.analyzers.documentation import analyze_documentation
from tools.analyzers.security import analyze_security
from tools.analyzers.code_structure import analyze_code_structure
from tools.analyzers.dependencies import analyze_dependencies
from tools.scorer import calculate_scores, calculate_composite_score
from tools.verdict_writer import generate_verdict
from tools.db import update_analysis_status, save_analysis_results


def analyze_repo(
    repo_owner: str,
    repo_name: str,
    repo_branch: str | None = None,
) -> dict:
    """Run the full analysis pipeline. Returns results dict."""
    start_time = time.time()
    repo_path = None

    try:
        # Download
        github_token = os.environ.get("GITHUB_TOKEN")
        repo_path = download_and_extract(repo_owner, repo_name, repo_branch, github_token)

        # Scan
        scan = scan_repo(repo_path)

        # Run all analyzers
        findings = []
        findings.extend(analyze_error_handling(scan.files))
        findings.extend(analyze_test_coverage(scan))
        findings.extend(analyze_documentation(scan))
        findings.extend(analyze_security(scan.files))
        findings.extend(analyze_code_structure(scan.files))
        findings.extend(analyze_dependencies(scan.package_json, scan.total_loc, scan.has_lock_file))

        # Score
        scores = calculate_scores(findings, scan.total_files, scan.total_loc)
        slop_score = calculate_composite_score(scores)

        # Generate verdict
        metadata = {
            "total_files": scan.total_files,
            "total_loc": scan.total_loc,
            "languages": scan.languages,
            "primary_language": scan.primary_language,
            "has_package_json": scan.package_json is not None,
            "dep_count": len(scan.package_json.get("dependencies", {})) if scan.package_json else 0,
            "dev_dep_count": len(scan.package_json.get("devDependencies", {})) if scan.package_json else 0,
            "repo_size_mb": round(sum(f.loc for f in scan.files) * 50 / 1024 / 1024, 1),  # rough estimate
            "analysis_duration_ms": 0,  # filled in below
        }

        verdict = generate_verdict(
            repo_name=f"{repo_owner}/{repo_name}",
            slop_score=slop_score,
            scores=scores,
            findings=findings,
            metadata=metadata,
        )

        duration_ms = round((time.time() - start_time) * 1000)
        metadata["analysis_duration_ms"] = duration_ms

        return {
            "slop_score": slop_score,
            "scores": scores,
            "verdict": verdict,
            "receipts": findings,
            "metadata": metadata,
        }

    finally:
        # Clean up downloaded repo
        if repo_path and repo_path.exists():
            shutil.rmtree(repo_path.parent, ignore_errors=True)


def run_analysis(
    analysis_id: str,
    repo_owner: str,
    repo_name: str,
    repo_branch: str | None = None,
):
    """Run analysis and save results to Supabase."""
    update_analysis_status(analysis_id, "analyzing")

    results = analyze_repo(repo_owner, repo_name, repo_branch)
    save_analysis_results(analysis_id, results)
```

- [ ] **Step 4: Run test**

Run: `cd scoring-service && python -m pytest tests/test_pipeline.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scoring-service/tools/pipeline.py scoring-service/tests/test_pipeline.py
git commit -m "feat: add end-to-end analysis pipeline"
```

---

## Chunk 5: Frontend Pages

### Task 15: Landing Page with URL Input

**Files:**
- Create: `src/app/page.tsx` (overwrite default)
- Create: `src/components/url-input.tsx`

Use the `frontend-design` skill for all UI implementation in this task.

- [ ] **Step 1: Create URL input component**

```typescript
// src/components/url-input.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function UrlInput() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      router.push(`/analyzing/${data.id}`)
    } catch {
      setError('Failed to start analysis. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(null) }}
            placeholder="owner/repo or https://github.com/owner/repo"
            className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 font-mono text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !url.trim()}
            className="px-6 py-3 bg-white text-black font-bold rounded-lg hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {loading ? 'Analyzing...' : 'Analyze'}
          </button>
        </div>
        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create landing page**

```typescript
// src/app/page.tsx
import { UrlInput } from '@/components/url-input'

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <h1 className="text-6xl font-black tracking-tight">
          Is It Slop?
        </h1>
        <p className="text-xl text-zinc-400 max-w-lg mx-auto">
          You vibe coded it. Let&apos;s see how that went.
        </p>
        <UrlInput />
        <p className="text-sm text-zinc-600">
          Paste a public GitHub repo URL. We&apos;ll tell you if your AI did you dirty.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Update global styles for dark theme**

Update `src/app/globals.css` to remove default Next.js styles and set dark defaults:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #000;
  color: #fff;
}
```

- [ ] **Step 4: Verify it renders**

Run: `pnpm dev`
Check: Landing page renders with input, dark theme, correct copy.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/url-input.tsx src/app/globals.css
git commit -m "feat: add landing page with URL input"
```

---

### Task 16: Analyzing/Loading Page

**Files:**
- Create: `src/app/analyzing/[id]/page.tsx`

- [ ] **Step 1: Create the polling page**

```typescript
// src/app/analyzing/[id]/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const SNARKY_MESSAGES = [
  "Downloading your masterpiece...",
  "Counting console.logs...",
  "Looking for tests... any tests...",
  "Checking if .env is committed (please no)...",
  "Measuring the spaghetti...",
  "Asking GPT what it thinks of GPT's code...",
  "Searching for error handling (found: catch(e) {})...",
  "Calculating your shame score...",
  "Reviewing 47 files your AI hallucinated...",
  "Almost done roasting you...",
]

export default function AnalyzingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [messageIndex, setMessageIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const TIMEOUT_MS = 120_000 // 2 minutes

  // Rotate snarky messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % SNARKY_MESSAGES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Poll for completion (with timeout)
  useEffect(() => {
    const poll = setInterval(async () => {
      if (Date.now() - startTime > TIMEOUT_MS) {
        setError('Analysis is taking too long. The repo might be too large or our service is busy. Try again later.')
        clearInterval(poll)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('analyses')
        .select('status, error_message')
        .eq('id', id)
        .single()

      if (fetchError) {
        setError('Could not find this analysis.')
        clearInterval(poll)
        return
      }

      if (data.status === 'complete') {
        clearInterval(poll)
        router.push(`/r/${id}`)
      } else if (data.status === 'error') {
        clearInterval(poll)
        setError(data.error_message || 'Analysis failed.')
      }
    }, 2000)

    return () => clearInterval(poll)
  }, [id, router, startTime])

  if (error) {
    return (
      <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-black">Oops</h1>
          <p className="text-red-400">{error}</p>
          <a href="/" className="text-zinc-400 hover:text-white underline">
            Try another repo
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-8">
        <div className="w-12 h-12 border-4 border-zinc-700 border-t-white rounded-full animate-spin mx-auto" />
        <p className="text-xl text-zinc-400 animate-pulse">
          {SNARKY_MESSAGES[messageIndex]}
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/analyzing/
git commit -m "feat: add analyzing page with polling and snarky messages"
```

---

### Task 17: Result Page

**Files:**
- Create: `src/app/r/[id]/page.tsx`
- Create: `src/components/slop-score.tsx`
- Create: `src/components/dimension-grades.tsx`
- Create: `src/components/verdict.tsx`
- Create: `src/components/findings-list.tsx`
- Create: `src/components/fix-prompt-card.tsx`
- Create: `src/components/share-buttons.tsx`

Use the `frontend-design` skill for all UI implementation in this task.

- [ ] **Step 1: Create score display component**

```typescript
// src/components/slop-score.tsx

interface SlopScoreProps {
  score: number
}

function getScoreColor(score: number): string {
  if (score <= 20) return 'text-green-400'
  if (score <= 40) return 'text-lime-400'
  if (score <= 60) return 'text-yellow-400'
  if (score <= 80) return 'text-orange-400'
  return 'text-red-400'
}

function getScoreLabel(score: number): string {
  if (score <= 10) return 'Pristine'
  if (score <= 25) return 'Pretty Clean'
  if (score <= 40) return 'Needs Work'
  if (score <= 55) return 'Kinda Sloppy'
  if (score <= 70) return 'Sloppy'
  if (score <= 85) return 'Sloppy AF'
  return 'Certified Slop'
}

export function SlopScore({ score }: SlopScoreProps) {
  return (
    <div className="text-center space-y-2">
      <div className={`text-8xl font-black tabular-nums ${getScoreColor(score)}`}>
        {score}
      </div>
      <div className="text-sm font-mono text-zinc-500 uppercase tracking-widest">
        Slop Score
      </div>
      <div className={`text-lg font-bold ${getScoreColor(score)}`}>
        {getScoreLabel(score)}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create dimension grades component**

```typescript
// src/components/dimension-grades.tsx
import type { DimensionScores, DimensionKey, LetterGrade } from '@/types/analysis'

const DIMENSION_LABELS: Record<DimensionKey, string> = {
  error_handling: 'Error Handling',
  test_coverage: 'Tests',
  documentation: 'Docs',
  security: 'Security',
  code_structure: 'Structure',
  dependencies: 'Dependencies',
}

function gradeColor(grade: LetterGrade): string {
  switch (grade) {
    case 'A': return 'text-green-400 border-green-400/30'
    case 'B': return 'text-lime-400 border-lime-400/30'
    case 'C': return 'text-yellow-400 border-yellow-400/30'
    case 'D': return 'text-orange-400 border-orange-400/30'
    case 'F': return 'text-red-400 border-red-400/30'
  }
}

interface DimensionGradesProps {
  scores: DimensionScores
}

export function DimensionGrades({ scores }: DimensionGradesProps) {
  const dimensions = Object.entries(scores) as [DimensionKey, { score: number; grade: LetterGrade; findings_count: number }][]

  return (
    <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
      {dimensions.map(([key, data]) => (
        <div
          key={key}
          className={`border rounded-lg p-3 text-center ${gradeColor(data.grade)}`}
        >
          <div className="text-3xl font-black">{data.grade}</div>
          <div className="text-xs text-zinc-500 mt-1">{DIMENSION_LABELS[key]}</div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create verdict component**

```typescript
// src/components/verdict.tsx

interface VerdictProps {
  verdict: string
}

export function Verdict({ verdict }: VerdictProps) {
  // Split verdict into overall and dimension lines
  const lines = verdict.split('\n').filter(Boolean)

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {lines.map((line, i) => {
        // Check if it's a dimension commentary line (starts with **)
        const dimMatch = line.match(/^\*\*(.+?):\*\*\s*(.+)$/)
        if (dimMatch) {
          return (
            <div key={i} className="text-sm">
              <span className="font-bold text-zinc-300">{dimMatch[1]}:</span>{' '}
              <span className="text-zinc-400">{dimMatch[2]}</span>
            </div>
          )
        }

        // Overall verdict (first non-dimension lines)
        return (
          <p key={i} className="text-lg text-zinc-200 leading-relaxed">
            {line}
          </p>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Create fix prompt card component**

```typescript
// src/components/fix-prompt-card.tsx
'use client'

import { useState } from 'react'
import type { Finding } from '@/types/analysis'

interface FixPromptCardProps {
  finding: Finding
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'critical': return 'border-red-500/50 bg-red-500/5'
    case 'high': return 'border-orange-500/50 bg-orange-500/5'
    case 'medium': return 'border-yellow-500/50 bg-yellow-500/5'
    case 'low': return 'border-zinc-600 bg-zinc-800/50'
    default: return 'border-zinc-700'
  }
}

export function FixPromptCard({ finding }: FixPromptCardProps) {
  const [copied, setCopied] = useState(false)

  function copyPrompt() {
    navigator.clipboard.writeText(finding.fix_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`border rounded-lg p-4 space-y-3 ${severityColor(finding.severity)}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-mono uppercase text-zinc-500">
            {finding.severity}
          </span>
          <p className="text-sm text-zinc-200">{finding.issue}</p>
          {finding.file && (
            <p className="text-xs font-mono text-zinc-500">
              {finding.file}{finding.line ? `:${finding.line}` : ''}
            </p>
          )}
        </div>
      </div>

      {finding.evidence && (
        <pre className="text-xs font-mono text-zinc-500 bg-zinc-900 rounded p-2 overflow-x-auto">
          {finding.evidence}
        </pre>
      )}

      <div className="flex items-center gap-2">
        <div className="flex-1 text-xs text-zinc-400 bg-zinc-900 rounded p-2 font-mono">
          {finding.fix_prompt}
        </div>
        <button
          onClick={copyPrompt}
          className="shrink-0 px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded transition-colors"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create findings list component**

```typescript
// src/components/findings-list.tsx
import type { Finding } from '@/types/analysis'
import { FixPromptCard } from './fix-prompt-card'

interface FindingsListProps {
  findings: Finding[]
}

export function FindingsList({ findings }: FindingsListProps) {
  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...findings].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  )

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-zinc-200">
        The Receipts ({findings.length})
      </h2>
      {sorted.map((finding, i) => (
        <FixPromptCard key={i} finding={finding} />
      ))}
    </div>
  )
}
```

- [ ] **Step 6: Create share buttons component**

```typescript
// src/components/share-buttons.tsx
'use client'

import { useState } from 'react'

interface ShareButtonsProps {
  url: string
  repoName: string
  slopScore: number
}

export function ShareButtons({ url, repoName, slopScore }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false)

  const tweetText = `Just ran ${repoName} through @IsItSlop... ${slopScore}/100. ${slopScore > 60 ? 'Pain.' : slopScore > 30 ? 'Could be worse.' : 'Not bad actually.'}`
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodeURIComponent(url)}`

  function copyLink() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex gap-3 justify-center">
      <a
        href={twitterUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
      >
        Share on X
      </a>
      <button
        onClick={copyLink}
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
      >
        {copied ? 'Copied!' : 'Copy Link'}
      </button>
    </div>
  )
}
```

- [ ] **Step 7: Create result page**

```typescript
// src/app/r/[id]/page.tsx
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { SlopScore } from '@/components/slop-score'
import { DimensionGrades } from '@/components/dimension-grades'
import { Verdict } from '@/components/verdict'
import { FindingsList } from '@/components/findings-list'
import { ShareButtons } from '@/components/share-buttons'
import type { Analysis } from '@/types/analysis'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('analyses')
    .select('repo_owner, repo_name, slop_score')
    .eq('id', id)
    .single()

  if (!data) return { title: 'IsItSlop' }

  const title = `${data.repo_owner}/${data.repo_name} — Slop Score: ${data.slop_score}/100`
  const description = `IsItSlop analyzed ${data.repo_owner}/${data.repo_name} and gave it a ${data.slop_score}/100 slop score.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'IsItSlop',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function ResultPage({ params }: PageProps) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data || data.status !== 'complete') {
    notFound()
  }

  const analysis = data as Analysis
  const resultUrl = `https://isitslop.co/r/${id}`

  return (
    <main className="min-h-screen bg-black text-white py-16 px-4">
      <div className="max-w-3xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-2">
          <a
            href={analysis.repo_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-mono text-zinc-500 hover:text-zinc-300"
          >
            {analysis.repo_owner}/{analysis.repo_name}
          </a>
        </div>

        {/* Score */}
        <SlopScore score={analysis.slop_score!} />

        {/* Grades */}
        <DimensionGrades scores={analysis.scores!} />

        {/* Verdict */}
        <Verdict verdict={analysis.verdict!} />

        {/* Share */}
        <ShareButtons
          url={resultUrl}
          repoName={`${analysis.repo_owner}/${analysis.repo_name}`}
          slopScore={analysis.slop_score!}
        />

        {/* Findings */}
        {analysis.receipts && analysis.receipts.length > 0 && (
          <FindingsList findings={analysis.receipts} />
        )}

        {/* CTA */}
        <div className="text-center pt-8 border-t border-zinc-800">
          <a
            href="/"
            className="text-zinc-400 hover:text-white underline"
          >
            Analyze another repo
          </a>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 8: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add src/components/ src/app/r/
git commit -m "feat: add result page with score, grades, verdict, findings, and share"
```

---

## Chunk 6: Integration & Deploy

### Task 18: Rate Limiting

**Files:**
- Modify: `src/app/api/analyze/route.ts`

- [ ] **Step 1: Write failing rate limit tests**

```typescript
// src/lib/__tests__/rate-limit.test.ts
import { checkRateLimit } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  it('allows first request', () => {
    const result = checkRateLimit('test-ip-' + Date.now())
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it('blocks after 5 requests', () => {
    const ip = 'test-ip-block-' + Date.now()
    for (let i = 0; i < 5; i++) {
      checkRateLimit(ip)
    }
    const result = checkRateLimit(ip)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- src/lib/__tests__/rate-limit.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement rate limiter**

Create `src/lib/rate-limit.ts`:

```typescript
// src/lib/rate-limit.ts
const requests = new Map<string, { count: number; resetAt: number }>()

const WINDOW_MS = 60 * 60 * 1000 // 1 hour
const MAX_REQUESTS = 5

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now()
  const entry = requests.get(ip)

  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, remaining: MAX_REQUESTS - 1 }
  }

  if (entry.count >= MAX_REQUESTS) {
    return { allowed: false, remaining: 0 }
  }

  entry.count++
  return { allowed: true, remaining: MAX_REQUESTS - entry.count }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/lib/__tests__/rate-limit.test.ts`
Expected: All PASS.

- [ ] **Step 5: Add rate limiting to API route**

Add to the top of the POST handler in `src/app/api/analyze/route.ts`:

```typescript
import { checkRateLimit } from '@/lib/rate-limit'

// Inside POST handler, before URL parsing:
const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
const { allowed, remaining } = checkRateLimit(ip)

if (!allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Try again in an hour.' },
    { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/rate-limit.ts src/lib/__tests__/rate-limit.test.ts src/app/api/analyze/route.ts
git commit -m "feat: add rate limiting to analyze endpoint"
```

---

### Task 19: Root Layout + Metadata

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update root layout with metadata**

```typescript
// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'IsItSlop — Vibe Code Gut Check',
  description: 'Paste a GitHub repo URL. Find out if your AI did you dirty. Get fix prompts to make it clean up its own mess.',
  metadataBase: new URL('https://isitslop.co'),
  openGraph: {
    title: 'IsItSlop — Vibe Code Gut Check',
    description: 'Paste a GitHub repo URL. Find out if your AI did you dirty.',
    siteName: 'IsItSlop',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IsItSlop — Vibe Code Gut Check',
    description: 'Paste a GitHub repo URL. Find out if your AI did you dirty.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: update root layout with SEO metadata"
```

---

### Task 20: End-to-End Smoke Test

> **Note:** OG image generation deferred to post-MVP. Text-based OG meta tags are included.

- [ ] **Step 1: Set up environment**

Create `.env.local` with actual Supabase and Modal credentials.

- [ ] **Step 2: Run the migration against Supabase**

Apply the migration via Supabase dashboard or CLI.

- [ ] **Step 3: Deploy Modal service**

```bash
cd scoring-service
modal deploy modal_app.py
```

Update `.env.local` with the Modal webhook URL.

- [ ] **Step 4: Test the full flow**

1. Run `pnpm dev`
2. Go to localhost:3000
3. Paste `octocat/Hello-World`
4. Verify: redirects to /analyzing/[id], polls, redirects to /r/[id]
5. Verify: score, grades, verdict, findings all render

- [ ] **Step 5: Fix any issues found**

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete MVP end-to-end flow"
```
