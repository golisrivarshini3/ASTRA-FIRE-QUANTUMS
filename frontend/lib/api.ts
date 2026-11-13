const API = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { cache: "no-store", ...init });
  } catch {
    throw new Error(`Cannot reach ASTRA-FIRE API at ${API}. Start the FastAPI backend and check NEXT_PUBLIC_API_URL/CORS settings.`);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API ${response.status} on ${path}: ${body.slice(0, 500)}`);
  }
  return response.json() as Promise<T>;
}

export function getJSON<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function postJSON<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function postFile<T>(path: string, file: File, extra?: Record<string, string>): Promise<T> {
  const form = new FormData();
  form.append("file", file);
  Object.entries(extra ?? {}).forEach(([key, value]) => form.append(key, value));
  return request<T>(path, { method: "POST", body: form });
}

export const API_BASE = API;
