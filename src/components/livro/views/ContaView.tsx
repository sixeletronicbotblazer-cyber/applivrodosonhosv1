'use client'

// Conta — e-mail, compras ativas, suporte, privacidade/exclusão e sair.

import { useState } from 'react'
import { api, type Entitlement, type ProductKey } from '@/lib/app-client'
import { useApp } from '@/lib/app-store'
import { PageHeader } from '@/components/livro/PageHeader'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'

const PRODUCT_LABEL: Record<ProductKey, string> = {
  book_pdf: 'Livro digital (PDF) — R$ 12,90',
  book_app: 'Livro + Aplicativo — R$ 24,90',
  federal_addon: 'Resultados da Federal (módulo adicional)',
}

export function ContaView() {
  const { me, navigate, logout } = useApp()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!me?.user) return null
  const entitlements: Entitlement[] = me.entitlements ?? []
  const active = entitlements.filter((e) => e.status === 'active')

  async function deleteAccount() {
    setDeleting(true)
    try {
      await api('/api/account/delete', { method: 'POST' })
      await logout()
      toast({ title: 'Conta excluída', description: 'Seus dados pessoais foram removidos.' })
    } catch {
      toast({ title: 'Não foi possível excluir agora', description: 'Tente novamente ou fale com o suporte.' })
      setDeleting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Conta e ajuda" subtitle="Seu acesso, compras e privacidade" />

      <div className="mx-auto w-full max-w-3xl px-5 py-7 md:px-8">
        <section className="rounded-2xl border border-linha bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-roxo">E-mail da conta</p>
          <p className="mt-1.5 text-lg font-semibold text-tinta">{me.user.email}</p>
          {me.user.role === 'ADMIN' ? (
            <Button variant="outline" onClick={() => navigate('admin')} className="focus-ring mt-3 h-10 rounded-xl border-roxo/30 px-4 text-sm font-bold text-roxo hover:bg-lilas">
              Abrir painel de administração →
            </Button>
          ) : null}
        </section>

        <section className="mt-4 rounded-2xl border border-linha bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-roxo">Compras ativas</p>
          {active.length === 0 ? (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Nenhuma compra ativa localizada. Se você acabou de comprar, aguarde a confirmação do pagamento e entre novamente.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {active.map((e) => (
                <li key={e.paymentId ?? e.productKey} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-lilas/50 px-4 py-3">
                  <span className="text-sm font-semibold text-tinta">{PRODUCT_LABEL[e.productKey] ?? e.productKey}</span>
                  <span className="rounded-full bg-verde-bg px-2.5 py-1 text-[11px] font-bold uppercase text-verde">ativa</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Compras processadas pela plataforma de pagamento. Preço não é comprovante de acesso: o direito nasce do pagamento confirmado.
          </p>
        </section>

        <section className="mt-4 rounded-2xl border border-linha bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-roxo">Suporte</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Compra não liberada, upgrade de PDF para o pacote completo ou dúvidas de uso:
          </p>
          <a href="mailto:suporte@livrodossonhos.app" className="focus-ring mt-2 inline-block text-sm font-bold text-roxo underline-offset-2 hover:underline">
            suporte@livrodossonhos.app
          </a>
        </section>

        <section className="mt-4 rounded-2xl border border-linha bg-white p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-roxo">Privacidade</p>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            A busca registra apenas contagens — o texto do seu sonho não é armazenado. Os verbetes salvos ficam na sua conta e podem
            ser apagados em <strong className="text-tinta">Salvos</strong>.
          </p>
          {confirmDelete ? (
            <div className="mt-3 rounded-xl bg-[#FBF1F0] px-4 py-3" role="alertdialog" aria-label="Confirmar exclusão da conta">
              <p className="text-sm font-medium text-[#7A2E28]">
                Isso apaga salvos e sessões e anonimiza a conta. Registros de pagamento permanecem anônimos por exigência fiscal.
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => void deleteAccount()} disabled={deleting} className="focus-ring h-10 rounded-xl bg-destructive px-4 text-sm font-bold text-white hover:bg-destructive/90">
                  {deleting ? 'Excluindo…' : 'Excluir definitivamente'}
                </Button>
                <Button variant="outline" onClick={() => setConfirmDelete(false)} className="focus-ring h-10 rounded-xl border-linha bg-white px-4 text-sm font-bold text-tinta hover:bg-lilas">
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="focus-ring mt-3 text-sm font-semibold text-destructive underline-offset-2 hover:underline"
            >
              Excluir minha conta e dados
            </button>
          )}
        </section>

        <Button
          variant="outline"
          onClick={() => void logout()}
          className="focus-ring mt-4 h-13 w-full rounded-2xl border-linha bg-white text-base font-bold text-roxo hover:bg-lilas"
        >
          Sair da conta
        </Button>
      </div>
    </div>
  )
}
