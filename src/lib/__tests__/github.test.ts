import { parseGitHubUrl } from '@/lib/github'

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
