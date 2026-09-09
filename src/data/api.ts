/** Browser transport only: domain DTOs and use cases live behind the API. */
export const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')
export const apiUrl = (path: string) => `${API_URL}${path}`
export const mediaUrl = (path: string) => path.startsWith('/api/') ? apiUrl(path.slice(4)) : path
export class ApiRequestError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message) }
}
export async function apiResponse(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const response = await fetch(apiUrl(path), { ...options, headers, credentials: 'include' })
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event('session-expired'))
    const body = await response.json().catch(() => null)
    throw new ApiRequestError(response.status, body?.error?.code || 'REQUEST_FAILED', body?.error?.message || 'Request failed. Please try again.')
  }
  return response
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await apiResponse(path, options)
  return response.status === 204 ? undefined as T : response.json()
}
export const jsonBody = (value: unknown) => JSON.stringify(value)
