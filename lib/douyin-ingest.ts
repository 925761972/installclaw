import { randomUUID } from "node:crypto";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { tmpdir } from "node:os";
import { uploadBinaryToMediaKit } from "./volcengine.ts";

type IngestInput = {
  sourceUrl: string;
  sourceName: string;
};

type IngestDeps = {
  fetchImpl?: typeof fetch;
  createTempFile?: () => Promise<string>;
  writeTempFile?: (path: string, blob: Blob) => Promise<void>;
  readTempFileAsBlob?: (path: string, contentType: string) => Promise<Blob>;
  uploadBinaryToMediaKit?: typeof uploadBinaryToMediaKit;
  deleteTempFile?: (path: string) => Promise<void>;
};

function safeExt(name: string) {
  const ext = extname(basename(name)).toLowerCase();
  return ext && /^[.a-z0-9]+$/.test(ext) ? ext : ".mp4";
}

async function defaultCreateTempFile(sourceName: string) {
  return join(tmpdir(), `douyin-${randomUUID()}${safeExt(sourceName)}`);
}

export async function ingestDouyinVideo(
  input: IngestInput,
  deps: IngestDeps = {}
) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const createTempFile = deps.createTempFile ?? (() => defaultCreateTempFile(input.sourceName));
  const writeTempFile = deps.writeTempFile ?? (async (path, blob) => {
    await writeFile(path, Buffer.from(await blob.arrayBuffer()));
  });
  const readTempFileAsBlob = deps.readTempFileAsBlob ?? (async (path, contentType) => {
    return new Blob([await readFile(path)], { type: contentType });
  });
  const upload = deps.uploadBinaryToMediaKit ?? uploadBinaryToMediaKit;
  const deleteTempFile = deps.deleteTempFile ?? (async (path) => {
    await unlink(path).catch(() => undefined);
  });

  const response = await fetchImpl(input.sourceUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`抖音视频下载失败（${response.status}）`);

  const contentType = response.headers.get("content-type") || "video/mp4";
  if (!contentType.startsWith("video/")) throw new Error("抖音视频类型无效");

  const tempPath = await createTempFile();

  try {
    const blob = await response.blob();
    await writeTempFile(tempPath, blob);
    const uploadBlob = await readTempFileAsBlob(tempPath, contentType);
    return await upload(uploadBlob, contentType);
  } finally {
    await deleteTempFile(tempPath);
  }
}
