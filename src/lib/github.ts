export interface GitHubRepo {
  owner: string
  repo: string
  branch: string | null
}

export function parseGitHubUrl(input: string): GitHubRepo | null {
  if (!input || !input.trim()) return null

  let cleaned = input.trim()

  // Try owner/repo shorthand first — exactly one slash, owner has no dots (not a hostname)
  const shorthandMatch = cleaned.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/)
  if (shorthandMatch) {
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

  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
    return null
  }

  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2) return null

  const owner = parts[0]
  let repo = parts[1].replace(/\.git$/, '')
  let branch: string | null = null

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
