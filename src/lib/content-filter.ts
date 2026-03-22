// Basic content filter for user-visible repo names on public pages.
// Not comprehensive — just catches the obvious stuff that would
// look bad on the homepage if someone submitted a troll repo.

const BLOCKED_PATTERNS = [
  // Slurs and hate speech (partial matches)
  /\bn[i1]gg/i,
  /\bf[a@]gg/i,
  /\bk[i1]ke\b/i,
  /\bsp[i1]c\b/i,
  /\bch[i1]nk\b/i,
  /\btr[a@]nn/i,
  /\bret[a@]rd/i,
  // Sexual content
  /\bp[o0]rn/i,
  /\bhent[a@]i/i,
  /\bxxx\b/i,
  // Violence
  /\bk[i1]ll.*jews/i,
  /\bgenocide/i,
  // General trolling of the tool
  /\bfuck.*isitslop/i,
  /\bisitslop.*sucks/i,
]

export function isRepoNameSafe(owner: string, name: string): boolean {
  const combined = `${owner}/${name}`
  return !BLOCKED_PATTERNS.some((p) => p.test(combined))
}
