// Helpers de resposta padronizada para as APIs.
import { NextResponse } from 'next/server'

export type ApiErrorCode =
  | 'auth_required'
  | 'forbidden'
  | 'upgrade_required'
  | 'not_found'
  | 'bad_request'
  | 'rate_limited'
  | 'server_error'

export function apiError(code: ApiErrorCode, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status })
}

export function apiOk<T extends object>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonBody<T>(req: Request): Promise<T> {
  return req.json() as Promise<T>
}
