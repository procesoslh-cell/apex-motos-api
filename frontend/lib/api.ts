export const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

function normalizePath(path: string) {
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.startsWith('/api/')) return path;
  return `/api${path}`;
}

export function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

export function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function parse(r: Response) {
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export async function apiGet(path: string) {
  return parse(
    await fetch(`${API_URL}${normalizePath(path)}`, {
      headers: authHeaders(),
      cache: 'no-store',
    })
  );
}

export async function apiPost(path: string, body: unknown) {
  return parse(
    await fetch(`${API_URL}${normalizePath(path)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    })
  );
}

export async function apiPut(path: string, body: unknown) {
  return parse(
    await fetch(`${API_URL}${normalizePath(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    })
  );
}

export async function apiPatch(path: string, body: unknown) {
  return parse(
    await fetch(`${API_URL}${normalizePath(path)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    })
  );
}

export async function apiDelete(path: string) {
  return parse(
    await fetch(`${API_URL}${normalizePath(path)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
  );
}

export async function apiUpload(path: string, file: File) {
  const f = new FormData();
  f.append('file', file);

  return parse(
    await fetch(`${API_URL}${normalizePath(path)}`, {
      method: 'POST',
      headers: authHeaders(),
      body: f,
    })
  );
}

export async function apiDownload(path: string, filename: string) {
  const r = await fetch(`${API_URL}${normalizePath(path)}`, {
    headers: authHeaders(),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
