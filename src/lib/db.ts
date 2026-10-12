import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

// ── Bootstrap do banco para ambiente serverless (Vercel) ────────────────────
// O filesystem do lambda é efêmero e somente leitura fora de /tmp. O arquivo
// SQLite empacotado no deployment (db/custom.db, incluído pelo output file
// tracing) é copiado para /tmp no cold start da instância; enquanto a
// instância estiver quente, o mesmo arquivo é reutilizado (sessões continuam
// válidas entre invocações). Em ambiente local nada muda.
function bootstrapDatabaseUrl(): void {
  const explicit = process.env.DATABASE_URL?.trim()
  if (explicit && explicit.includes('/tmp/')) return // já aponta para o banco copiado

  const isVercel = !!process.env.VERCEL
  const target = '/tmp/livro-dos-sonhos.db'

  const bundled = [
    path.join(process.cwd(), 'db', 'custom.db'),
    path.join(process.cwd(), '..', 'db', 'custom.db'),
  ].find((p) => fs.existsSync(p))

  if (isVercel) {
    if (bundled && !fs.existsSync(target)) {
      try {
        fs.copyFileSync(bundled, target)
      } catch {
        // segue com o caminho em /tmp mesmo se a cópia falhar (Prisma abrirá vazio
        // e as rotas responderão com erro claro, em vez de crashar o módulo)
      }
    }
    process.env.DATABASE_URL = `file:${target}`
    return
  }

  if (!explicit && bundled) process.env.DATABASE_URL = `file:${bundled}`
}
bootstrapDatabaseUrl()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.VERCEL ? [] : ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
