type EventInput =
  | { eventType: 'FEED_VIEW', boardSlug: string, listPage: number, itemCount: number }
  | { eventType: 'POST_VIEW', boardSlug: string, postId: number }
  | {
      eventType: 'DETAIL_LIST_VIEW'
      boardSlug: string
      postId: number
      listPage: number
      itemCount: number
    }

interface StoredAnonymousId {
  id: string
  expiresAt: number
}

interface StoredSessionId {
  id: string
  lastActiveAt: number
}

const ANONYMOUS_KEY = 'blariyo_anonymous_id'
const SESSION_KEY = 'blariyo_session_id'
const ANONYMOUS_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SESSION_IDLE_MS = 30 * 60 * 1000
let fallbackAnonymous: StoredAnonymousId | null = null
let fallbackSession: StoredSessionId | null = null

function parseStored<T>(storage: Storage, key: string): T | null {
  try {
    const raw = storage.getItem(key)
    return raw ? JSON.parse(raw) as T : null
  } catch {
    return null
  }
}

function store(storage: Storage, key: string, value: object) {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    // 브라우저 저장소가 차단돼도 현재 page의 익명 통계는 유지한다.
  }
}

function anonymousId(now: number) {
  const stored = parseStored<StoredAnonymousId>(localStorage, ANONYMOUS_KEY) || fallbackAnonymous
  if (stored && typeof stored.id === 'string' && stored.expiresAt > now) return stored.id
  const created = { id: crypto.randomUUID(), expiresAt: now + ANONYMOUS_TTL_MS }
  fallbackAnonymous = created
  store(localStorage, ANONYMOUS_KEY, created)
  return created.id
}

function sessionId(now: number) {
  const stored = parseStored<StoredSessionId>(sessionStorage, SESSION_KEY) || fallbackSession
  const active = stored && typeof stored.id === 'string' && now - stored.lastActiveAt < SESSION_IDLE_MS
  const current = active ? { id: stored.id, lastActiveAt: now } : { id: crypto.randomUUID(), lastActiveAt: now }
  fallbackSession = current
  store(sessionStorage, SESSION_KEY, current)
  return current.id
}

export function usePublicEvent() {
  function track(input: EventInput) {
    if (!import.meta.client) return
    const now = Date.now()
    void $fetch('/api/v1/events', {
      method: 'POST',
      body: {
        ...input,
        anonymousId: anonymousId(now),
        sessionId: sessionId(now),
        occurredAt: new Date(now).toISOString(),
      },
    }).catch(() => {
      // 통계 장애는 공개 콘텐츠 열람을 막지 않는다.
    })
  }

  return { track }
}
