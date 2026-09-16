// Phase 2 — server-backed partner pairing (gracefully no-ops when API unavailable).
import { api } from './api.js'

export async function partnerInvite() {
  return api('/api/partner/invite', { method: 'POST', body: '{}' })
}

export async function partnerAccept(code) {
  return api('/api/partner/accept', { method: 'POST', body: JSON.stringify({ code: String(code || '').trim() }) })
}

export async function partnerUnlink() {
  return api('/api/partner', { method: 'DELETE', body: '{}' })
}

export async function partnerGet() {
  return api('/api/partner')
}

export async function partnerPushSummary(summary) {
  return api('/api/partner/summary', { method: 'PUT', body: JSON.stringify({ summary }) })
}

/** True when partner API endpoints exist on this instance. Cached per session. */
let partnerApiOk = null
export async function partnerApiAvailable() {
  if (partnerApiOk != null) return partnerApiOk
  try {
    const r = await fetch('/api/partner', { headers: { Accept: 'application/json' } })
    const ct = r.headers.get('content-type') || ''
    partnerApiOk = ct.includes('application/json') && r.status !== 404 && r.status !== 405
  } catch (e) {
    partnerApiOk = false
  }
  return partnerApiOk
}
