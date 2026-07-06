import { randomBytes } from "node:crypto";

type PreviewEntry = { userId: string; videoUrl: string; expiresAt: number };
const globalPreview = globalThis as unknown as { videoPreviewEntries?: Map<string, PreviewEntry> };
const entries = globalPreview.videoPreviewEntries ?? new Map<string, PreviewEntry>();
globalPreview.videoPreviewEntries = entries;

export function registerVideoPreview(userId: string, videoUrl: string) {
  const now = Date.now();
  for (const [key, entry] of entries) if (entry.expiresAt <= now) entries.delete(key);
  const token = randomBytes(24).toString("base64url");
  entries.set(token, { userId, videoUrl, expiresAt: now + 30 * 60_000 });
  return token;
}

export function getVideoPreview(token: string, userId: string) {
  const entry = entries.get(token);
  if (!entry || entry.userId !== userId || entry.expiresAt <= Date.now()) {
    if (entry?.expiresAt && entry.expiresAt <= Date.now()) entries.delete(token);
    return null;
  }
  return entry.videoUrl;
}
