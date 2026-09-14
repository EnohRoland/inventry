export type User = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  active?: boolean;
};
export type Location = { id: string; name: string; description: string };
export type Supplier = { id: string; name: string; email: string; phone: string };
export type Item = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  reorder_point: number;
  unit_cost: string;
  quantity: number;
  stock: { location_id: string; location: string; quantity: number }[];
};
export type Movement = {
  id: string;
  item: string;
  sku: string;
  location: string;
  type: string;
  quantity: number;
  reason: string;
  actor: string;
  created_at: string;
};
export type Order = {
  id: string;
  number: string;
  supplier: string;
  location: string;
  status: string;
  total: string;
  created_at: string;
  lines: { item_id: string; item: string; quantity: number; unit_cost: number }[];
};
export type Audit = {
  id: string;
  actor: string;
  action: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: string;
};
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me')
      window.dispatchEvent(new Event('session-expired'));
    throw new Error(
      (await response.json().catch(() => ({}))).error || `Request failed (${response.status})`,
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}
