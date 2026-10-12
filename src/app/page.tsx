'use client'

// Raiz do aplicativo — AppShell com roteamento por hash (SPA).
// Estrutura: sidebar roxa no desktop · barra inferior no mobile · footer fixo ao fundo.

import { useEffect } from 'react'
import { useApp, type ViewName } from '@/lib/app-store'
import { EntrarView } from '@/components/livro/views/EntrarView'
import { InicioView } from '@/components/livro/views/InicioView'
import { BuscarView } from '@/components/livro/views/BuscarView'
import { VerbeteView } from '@/components/livro/views/VerbeteView'
import { LivroView } from '@/components/livro/views/LivroView'
import { FerramentasView } from '@/components/livro/views/FerramentasView'
import { SalvosView } from '@/components/livro/views/SalvosView'
import { ContaView } from '@/components/livro/views/ContaView'
import { AdminView } from '@/components/livro/views/AdminView'
import { Button } from '@/components/ui/button'

const PREMIUM_VIEWS: ViewName[] = ['buscar', 'ferramentas', 'salvos', 'verbete']

export default function Page() {
  const { route, me, meLoading, appConfig, refreshMe, loadConfig, syncFromHash } = useApp()

  useEffect(() => {
    syncFromHash()
    const onHash = () => syncFromHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [syncFromHash])

  useEffect(() => {
    void refreshMe()
    void loadConfig()
  }, [refreshMe, loadConfig])

  useEffect(() => {
    // PWA: service worker apenas em produção (não interfere no preview de dev)
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    }
  }, [])

  if (meLoading && !me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-papel" role="status" aria-label="Carregando">
        <div className="text-center">
          <span aria-hidden="true" className="inline-block animate-pulse text-3xl text-ouro">✦</span>
          <p className="mt-3 text-sm text-muted-foreground">Livro dos Sonhos</p>
        </div>
      </div>
    )
  }

  const loggedOut = !me?.user
  if (loggedOut || route.view === 'entrar') {
    if (loggedOut && route.view !== 'entrar') {
      // sessão ausente: força tela de acesso
      return <EntrarView />
    }
    if (route.view === 'entrar' && me?.user) {
      // já autenticado tocando em "entrar": vai para o início
      return <RedirectToInicio />
    }
    return <EntrarView />
  }

  // gating amigável no frontend (a autorização real está no servidor):
  // book_pdf só tem /livro; rotas premium exigem book_app.
  const access = me.access ?? { app: false, pdf: false, federal: false, federalEntitledOnly: false }
  if (PREMIUM_VIEWS.includes(route.view) && !access.app) {
    return <AppShellRoute view={route.view === 'verbete' ? 'buscar' : route.view}><UpgradeGateView pdfOnly={access.pdf} /></AppShellRoute>
  }

  return (
    <AppShellRoute view={route.view}>
      {route.view === 'inicio' ? <InicioView /> : null}
      {route.view === 'buscar' ? <BuscarView /> : null}
      {route.view === 'verbete' ? <VerbeteView /> : null}
      {route.view === 'livro' ? <LivroView /> : null}
      {route.view === 'ferramentas' ? <FerramentasView /> : null}
      {route.view === 'salvos' ? <SalvosView /> : null}
      {route.view === 'conta' ? <ContaView /> : null}
      {route.view === 'admin' ? <AdminView /> : null}
    </AppShellRoute>
  )
}

function RedirectToInicio() {
  const { navigate } = useApp()
  useEffect(() => {
    navigate('inicio')
  }, [navigate])
  return null
}

function AppShellRoute({ view, children }: { view: ViewName; children: React.ReactNode }) {
  const { navigate, me, appConfig, logout } = useApp()
  const active: ViewName | '' = view
  const email = me?.user?.email ?? ''

  return (
    <div className="flex min-h-screen flex-col bg-papel">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-roxo text-[#F4EDF8] md:flex" aria-label="Navegação principal">
        <div className="px-6 pb-6 pt-8">
          <button type="button" onClick={() => navigate('inicio')} className="focus-ring flex items-center gap-2 rounded-lg text-left">
            <span aria-hidden="true" className="text-ouro">✦</span>
            <span className="font-display text-xl font-bold">Livro dos Sonhos</span>
          </button>
          <p className="mt-1 pl-6 text-xs text-[#CDBBE0]">sua consulta, no seu ritmo</p>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Seções">
          <SideItem icon="home" label="Início" active={active === 'inicio'} onClick={() => navigate('inicio')} />
          <SideItem icon="search" label="Buscar" active={active === 'buscar' || active === 'verbete'} onClick={() => navigate('buscar')} />
          <SideItem icon="book" label="Livro" active={active === 'livro'} onClick={() => navigate('livro')} />
          <SideItem icon="tools" label="Ferramentas" active={active === 'ferramentas'} onClick={() => navigate('ferramentas')} />
          <SideItem icon="bookmark" label="Salvos" active={active === 'salvos'} onClick={() => navigate('salvos')} />
          {me?.user?.role === 'ADMIN' ? <SideItem icon="shield" label="Administração" active={active === 'admin'} onClick={() => navigate('admin')} /> : null}
        </nav>
        <div className="border-t border-white/10 px-3 py-4">
          <button type="button" onClick={() => navigate('conta')} className="focus-ring w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/5" aria-label="Conta">
            <span className="block truncate text-sm font-semibold">{email}</span>
            <span className="block text-xs text-[#CDBBE0]">Conta e ajuda</span>
          </button>
          <button type="button" onClick={() => void logout()} className="focus-ring mt-1 w-full rounded-xl px-3 py-2 text-left text-sm text-[#CDBBE0] transition-colors hover:bg-white/5 hover:text-white">
            Sair
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex min-h-screen flex-col md:ml-64">
        <main className="flex-1 pb-24 md:pb-8" id="conteudo">
          {/* Topbar mobile roxa compacta */}
          <div className="sticky top-0 z-20 flex items-center justify-between bg-roxo px-4 py-3 text-white md:hidden">
            <button type="button" onClick={() => navigate('inicio')} className="focus-ring flex items-center gap-2 rounded-lg">
              <span aria-hidden="true" className="text-ouro">✦</span>
              <span className="font-display text-base font-bold">Livro dos Sonhos</span>
            </button>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => navigate('salvos')} aria-label="Salvos" className="focus-ring flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
                <MiniIcon name="bookmark" />
              </button>
              <button type="button" onClick={() => navigate('conta')} aria-label="Conta" className="focus-ring flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10">
                <MiniIcon name="user" />
              </button>
            </div>
          </div>

          {children}
        </main>

        {/* Footer fixo ao fundo (mt-auto empurra; sem flutuar sobre conteúdo) */}
        <footer className="mt-auto border-t border-linha bg-white/70 px-5 pt-4 pb-[max(6.5rem,env(safe-area-inset-bottom))] md:px-8 md:pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <p>As associações são para consulta. Não garantem resultado de jogo.</p>
            <p>
              {appConfig?.demoMode ? 'Ambiente de demonstração · ' : ''}Livro dos Sonhos · consulta editorial
            </p>
          </div>
        </footer>
      </div>

      {/* Barra inferior mobile */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-linha bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-4 px-2 py-1.5">
          <BottomItem icon="home" label="Início" active={active === 'inicio'} onClick={() => navigate('inicio')} />
          <BottomItem icon="search" label="Buscar" active={active === 'buscar' || active === 'verbete'} onClick={() => navigate('buscar')} />
          <BottomItem icon="book" label="Livro" active={active === 'livro'} onClick={() => navigate('livro')} />
          <BottomItem icon="tools" label="Ferramentas" active={active === 'ferramentas'} onClick={() => navigate('ferramentas')} />
        </div>
      </nav>
    </div>
  )
}

function SideItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? 'bg-[#4B1C70] text-white' : 'text-[#D9C6EA] hover:bg-white/5 hover:text-white'
      }`}
    >
      <MiniIcon name={icon} />
      {label}
    </button>
  )
}

function BottomItem({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`focus-ring flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-semibold transition-colors ${
        active ? 'bg-lilas text-roxo' : 'text-muted-foreground hover:text-roxo'
      }`}
    >
      <MiniIcon name={icon} size={20} />
      {label}
    </button>
  )
}

function MiniIcon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <path d="M9 22V12h6v10" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      )
    case 'book':
      return (
        <svg {...common}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      )
    case 'tools':
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2" transform="rotate(45 12 12)" />
        </svg>
      )
    case 'bookmark':
      return (
        <svg {...common}>
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
        </svg>
      )
    default:
      return null
  }
}

function UpgradeGateView({ pdfOnly }: { pdfOnly: boolean }) {
  const { navigate } = useApp()
  return (
    <div>
      <div className="bg-roxo px-5 pt-8 pb-7 text-[#F4EDF8] md:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <p className="font-display text-[22px] font-bold md:text-2xl">Recurso do pacote completo</p>
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8">
        <div className="rounded-2xl border border-linha bg-white p-6 md:p-8">
          <span aria-hidden="true" className="text-2xl">🔒</span>
          <h2 className="font-display mt-2 text-2xl font-bold text-tinta">
            {pdfOnly ? 'Sua compra atual inclui o PDF' : 'Acesso não localizado'}
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            {pdfOnly
              ? 'A busca por sonhos, a tabela dos bichos, o gerador de combinações e os salvos fazem parte do pacote Livro + Aplicativo (R$ 24,90). Quem comprou o PDF (R$ 12,90) pode completar o pacote com o upgrade de R$ 19,90.'
              : 'Esta área faz parte do pacote Livro + Aplicativo (R$ 24,90). O acesso é liberado automaticamente após a confirmação do pagamento.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => navigate('livro')} className="focus-ring h-12 rounded-2xl bg-roxo px-6 font-semibold text-white hover:bg-roxo-2">
              Abrir o livro
            </Button>
            <Button variant="outline" onClick={() => navigate('conta')} className="focus-ring h-12 rounded-2xl border-linha bg-white px-6 font-semibold text-roxo hover:bg-lilas">
              Ver minha conta
            </Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Suporte: <a href="mailto:suporte@livrodossonhos.app" className="font-semibold text-roxo underline-offset-2 hover:underline">suporte@livrodossonhos.app</a>
          </p>
        </div>
      </div>
    </div>
  )
}
