import { NextResponse } from "next/server";

export function jsonNoStore(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return NextResponse.json(data, { ...init, headers });
}

export function badRequest(message: string) {
  return jsonNoStore({ error: message }, { status: 400 });
}

export function unauthorized(message: string) {
  return jsonNoStore({ error: message }, { status: 401 });
}

export function notFound(message: string) {
  return jsonNoStore({ error: message }, { status: 404 });
}

export function serverError(message: string) {
  return jsonNoStore({ error: message }, { status: 500 });
}

export function toInt(value: string | null) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}
