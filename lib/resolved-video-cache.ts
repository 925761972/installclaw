import { randomBytes } from "node:crypto";

export type ResolvedVideoCacheEntry = {
  userId: string;
  videoUrl: string;
  durationSeconds: number;
  sourceName: string;
  sourceType: "direct" | "douyin";
  expiresAt: number;
};

type ResolvedVideoRegistration = Omit<ResolvedVideoCacheEntry, "expiresAt">;

const globalResolvedVideo = globalThis as unknown as { resolvedVideoEntries?: Map<string, ResolvedVideoCacheEntry> };
const entries = globalResolvedVideo.resolvedVideoEntries ?? new Map<string, ResolvedVideoCacheEntry>();
globalResolvedVideo.resolvedVideoEntries = entries;

function pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of entries) {
    if (entry.expiresAt <= now) entries.delete(key);
  }
}

export function registerResolvedVideo(input: ResolvedVideoRegistration) {
  pruneExpired();
  const token = randomBytes(24).toString("base64url");
  entries.set(token, { ...input, expiresAt: Date.now() + 30 * 60_000 });
  return token;
}

export function getResolvedVideo(token: string, userId: string, videoUrl: string) {
  pruneExpired();
  const entry = entries.get(token);
  if (!entry) return null;
  if (entry.userId !== userId || entry.videoUrl !== videoUrl) return null;
  return entry;
}

