'use client'

// Estado global do app (zustand): roteamento por hash, sessão e configuração.
// Hash routing: #/inicio, #/buscar, #/verbete/cavalo, #/livro?pagina=46 …

import { create } from 'zustand'
import { api, type Me, type AppConfig } from '@/lib/app-client'

export type ViewName = 'entrar' | 'inicio' | 'buscar' | 'verbete' | 'livro' | 'ferramentas' | 'salvos' | 'conta' | 'admin'

export type Route = {
  view: ViewName
  slug?: string
  params: Record<string, string>
}

export function parseHash(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [pathPart, queryPart] = clean.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const params: Record<string, string> = {}
  if (queryPart) {
    for (const [k, v] of new URLSearchParams(queryPart).entries()) params[k] = v
  }
  const view = (segments[0] || 'inicio') as ViewName
  const known: ViewName[] = ['entrar', 'inicio', 'buscar', 'verbete', 'livro', 'ferramentas', 'salvos', 'conta', 'admin']
  if (!known.includes(view)) return { view: 'inicio', params }
  return { view, slug: segments[1], params }
}

export function routeToHash(route: Route): string {
  const base = `#/${route.view}${route.slug ? `/${route.slug}` : ''}`
  const qs = new URLSearchParams(route.params).toString()
  return qs ? `${base}?${qs}` : base
}

type AppState = {
  route: Route
  me: Me | null
  meLoading: boolean
  appConfig: AppConfig | null
  navigate: (view: ViewName, opts?: { slug?: string; params?: Record<string, string> }) => void
  patchParams: (params: Record<string, string>) => void
  syncFromHash: () => void
  refreshMe: () => Promise<void>
  loadConfig: () => Promise<void>
  logout: () => Promise<void>
}

export const useApp = create<AppState>((set, get) => ({
  route: { view: 'inicio', params: {} },
  me: null,
  meLoading: true,
  appConfig: null,

  navigate: (view, opts) => {
    const hash = routeToHash({ view, slug: opts?.slug, params: opts?.params ?? {} })
    if (window.location.hash !== hash) {
      window.location.hash = hash
    } else {
      set({ route: parseHash(hash) })
    }
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  },

  patchParams: (params) => {
    const cur = get().route
    const merged = { ...cur.params, ...params }
    for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k]
    const hash = routeToHash({ view: cur.view, slug: cur.slug, params: merged })
    if (window.location.hash !== hash) window.location.hash = hash
    else set({ route: { ...cur, params: merged } })
  },

  syncFromHash: () => {
    set({ route: parseHash(window.location.hash) })
  },

  refreshMe: async () => {
    set({ meLoading: true })
    try {
      const me = await api<Me>('/api/me')
      set({ me, meLoading: false })
      // sem sessão → tela de acesso (exceto se já estiver nela)
      if (!me.user && get().route.view !== 'entrar') {
        get().navigate('entrar')
      }
    } catch {
      set({ me: { user: null }, meLoading: false })
      if (get().route.view !== 'entrar') get().navigate('entrar')
    }
  },

  loadConfig: async () => {
    try {
      const cfg = await api<AppConfig>('/api/config')
      set({ appConfig: cfg })
    } catch {
      set({ appConfig: null })
    }
  },

  logout: async () => {
    await api('/api/auth/logout', { method: 'POST' })
    set({ me: { user: null } })
    get().navigate('entrar')
  },
}))
