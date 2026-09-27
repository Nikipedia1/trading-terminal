const ID_KEY = 'tt_workspace_id'
const NAME_KEY = 'tt_workspace_name'

/** URL-safe opaque id – treat as a private link, not a password. */
export function generateWorkspaceId(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function getOrCreateWorkspaceId(): string {
  try {
    const existing = localStorage.getItem(ID_KEY)
    if (existing && /^[a-zA-Z0-9_-]{8,64}$/.test(existing)) return existing
    const id = generateWorkspaceId()
    localStorage.setItem(ID_KEY, id)
    return id
  } catch {
    return generateWorkspaceId()
  }
}

export function setWorkspaceId(id: string): void {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) return
  try {
    localStorage.setItem(ID_KEY, id)
  } catch {
    /* private mode */
  }
}

export function getWorkspaceName(): string {
  try {
    return localStorage.getItem(NAME_KEY) || 'default'
  } catch {
    return 'default'
  }
}

export function setWorkspaceName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.slice(0, 64) || 'default')
  } catch {
    /* */
  }
}
