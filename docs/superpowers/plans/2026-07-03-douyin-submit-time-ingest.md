# Douyin Submit-Time Ingest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 仅对抖音链接模式，在用户点击“开始擦除”时执行服务端下载并上传到 MediaKit，随后复用现有 `mediakit://...` 提交流程，且自动清理服务器临时文件。

**Architecture:** 保持 `/api/video/resolve` 继续只做解析与缓存，不提前上传任何文件。新增一个独立的 `lib/douyin-ingest.ts` 负责“下载远程视频 -> 上传到 MediaKit -> 删除临时文件”，由 `/api/jobs` 在识别到 `resolvedToken` 对应抖音来源时调用；普通直链和本地上传路径保持不变。

**Tech Stack:** Next.js 16、TypeScript、Node.js 文件系统与临时目录、better-sqlite3、Node test runner、AI MediaKit 上传意图 API

---

## File Structure

- Create: `d:\TRAE\text clear\lib\douyin-ingest.ts`
  - 服务端下载抖音解析后视频到临时文件
  - 调用现有 MediaKit 上传意图
  - 上传成功后返回 `mediakit://...`
  - 在成功/失败两种路径都清理临时文件
- Modify: `d:\TRAE\text clear\lib\volcengine.ts`
  - 补服务端上传二进制文件到 MediaKit 的 helper
  - 保持现有本地上传和任务提交逻辑不回归
- Modify: `d:\TRAE\text clear\app\api\jobs\route.ts`
  - 在提交阶段识别抖音来源并切到中转链路
  - 维持现有积分预留、提交失败退款逻辑
- Test: `d:\TRAE\text clear\lib\douyin-ingest.test.mjs`
  - 验证只在提交时上传
  - 验证成功和失败路径都清理临时文件
- Test: `d:\TRAE\text clear\lib\volcengine.test.mjs`
  - 验证 `mediakit://` 拼装和上传 helper 行为

### Task 1: 补 MediaKit 服务端上传 Helper

**Files:**
- Modify: `d:\TRAE\text clear\lib\volcengine.ts`
- Test: `d:\TRAE\text clear\lib\volcengine.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildMediaKitRef, uploadBinaryToMediaKit } from "./volcengine.ts";

test("会把 file_id 规范成 mediakit 引用", () => {
  assert.equal(buildMediaKitRef("abc123"), "mediakit://abc123");
  assert.equal(buildMediaKitRef("mediakit://abc123"), "mediakit://abc123");
});

test("上传 helper 会使用 upload intent 返回的 PUT 地址", async () => {
  let called = 0;
  const file = new Blob(["demo"]);

  const result = await uploadBinaryToMediaKit(file, "video/mp4", {
    requestUploadIntent: async () => ({
      result: {
        file_id: "file-1",
        upload_url: "https://upload.example.com/put",
        upload_headers: []
      }
    }),
    fetchImpl: async (url, init) => {
      called += 1;
      assert.equal(url, "https://upload.example.com/put");
      assert.equal(init?.method, "PUT");
      return new Response(null, { status: 200 });
    }
  });

  assert.equal(called, 1);
  assert.equal(result.fileId, "file-1");
  assert.equal(result.videoRef, "mediakit://file-1");
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test lib/volcengine.test.mjs`
Expected: FAIL，提示 `buildMediaKitRef` 或 `uploadBinaryToMediaKit` 未导出

- [ ] **Step 3: 写最小实现**

```ts
export function buildMediaKitRef(fileId: string) {
  return fileId.startsWith("mediakit://") ? fileId : `mediakit://${fileId}`;
}

export async function uploadBinaryToMediaKit(
  body: Blob,
  contentType: string,
  deps: {
    requestUploadIntent?: typeof requestUploadIntent;
    fetchImpl?: typeof fetch;
  } = {}
) {
  const requestIntent = deps.requestUploadIntent ?? requestUploadIntent;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const intent = await requestIntent();
  const uploadUrl = intent?.result?.upload_url;
  const fileId = intent?.result?.file_id;
  if (!uploadUrl || !fileId) throw new Error("获取上传地址失败");

  const response = await fetchImpl(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body
  });
  if (!response.ok) throw new Error(`上传中转文件失败（${response.status}）`);

  return { fileId, videoRef: buildMediaKitRef(fileId) };
}
```

- [ ] **Step 4: 再跑测试并确认通过**

Run: `node --test lib/volcengine.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/volcengine.ts lib/volcengine.test.mjs
git commit -m "feat: add mediakit upload helper"
```

### Task 2: 实现抖音提交阶段中转模块

**Files:**
- Create: `d:\TRAE\text clear\lib\douyin-ingest.ts`
- Test: `d:\TRAE\text clear\lib\douyin-ingest.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { ingestDouyinVideo } from "./douyin-ingest.ts";

test("中转成功后返回 mediakit 引用并清理临时文件", async () => {
  const calls = [];
  const result = await ingestDouyinVideo({
    sourceUrl: "https://video.example.com/source.mp4",
    sourceName: "demo.mp4"
  }, {
    fetchImpl: async () => new Response(new Blob(["video"]), {
      status: 200,
      headers: { "Content-Type": "video/mp4" }
    }),
    createTempFile: async () => "C:\\temp\\douyin-demo.mp4",
    writeTempFile: async (path, blob) => calls.push(["write", path, blob.size]),
    readTempFileAsBlob: async (path, type) => {
      calls.push(["read", path, type]);
      return new Blob(["video"]);
    },
    uploadBinaryToMediaKit: async () => ({ fileId: "file-1", videoRef: "mediakit://file-1" }),
    deleteTempFile: async (path) => calls.push(["delete", path])
  });

  assert.equal(result.videoRef, "mediakit://file-1");
  assert.deepEqual(calls.at(-1), ["delete", "C:\\temp\\douyin-demo.mp4"]);
});

test("中转失败时仍然会删除临时文件", async () => {
  const calls = [];
  await assert.rejects(() => ingestDouyinVideo({
    sourceUrl: "https://video.example.com/source.mp4",
    sourceName: "demo.mp4"
  }, {
    fetchImpl: async () => new Response(new Blob(["video"]), {
      status: 200,
      headers: { "Content-Type": "video/mp4" }
    }),
    createTempFile: async () => "C:\\temp\\douyin-demo.mp4",
    writeTempFile: async () => undefined,
    readTempFileAsBlob: async () => new Blob(["video"]),
    uploadBinaryToMediaKit: async () => {
      throw new Error("upload failed");
    },
    deleteTempFile: async (path) => calls.push(["delete", path])
  }), /upload failed/);

  assert.deepEqual(calls, [["delete", "C:\\temp\\douyin-demo.mp4"]]);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test lib/douyin-ingest.test.mjs`
Expected: FAIL，提示 `ingestDouyinVideo` 未定义

- [ ] **Step 3: 写最小实现**

```ts
import { basename } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { unlink, writeFile, readFile } from "node:fs/promises";
import { uploadBinaryToMediaKit } from "./volcengine";

function safeExt(name: string) {
  const match = /\.[a-zA-Z0-9]+$/.exec(name);
  return match ? match[0] : ".mp4";
}

export async function ingestDouyinVideo(
  input: { sourceUrl: string; sourceName: string },
  deps: {
    fetchImpl?: typeof fetch;
    createTempFile?: () => Promise<string>;
    writeTempFile?: (path: string, blob: Blob) => Promise<void>;
    readTempFileAsBlob?: (path: string, contentType: string) => Promise<Blob>;
    uploadBinaryToMediaKit?: typeof uploadBinaryToMediaKit;
    deleteTempFile?: (path: string) => Promise<void>;
  } = {}
) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const createTempFile = deps.createTempFile ?? (async () => join(tmpdir(), `douyin-${randomUUID()}${safeExt(input.sourceName)}`));
  const writeTempFile = deps.writeTempFile ?? (async (path, blob) => writeFile(path, Buffer.from(await blob.arrayBuffer())));
  const readTempFileAsBlob = deps.readTempFileAsBlob ?? (async (path, contentType) => new Blob([await readFile(path)], { type: contentType }));
  const upload = deps.uploadBinaryToMediaKit ?? uploadBinaryToMediaKit;
  const deleteTempFile = deps.deleteTempFile ?? (async (path) => unlink(path).catch(() => undefined));

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
```

- [ ] **Step 4: 再跑测试并确认通过**

Run: `node --test lib/douyin-ingest.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add lib/douyin-ingest.ts lib/douyin-ingest.test.mjs
git commit -m "feat: add douyin submit-time ingest"
```

### Task 3: 把抖音中转接入任务提交

**Files:**
- Modify: `d:\TRAE\text clear\app\api\jobs\route.ts`
- Test: `d:\TRAE\text clear\app\api\jobs\route.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { resolveSubmissionVideoRef } from "./api/jobs/route.ts";

test("抖音来源在提交阶段会先转成 mediakit 引用", async () => {
  const result = await resolveSubmissionVideoRef({
    inputVideoRef: "https://douyin.example.com/video.mp4",
    resolvedVideo: {
      videoUrl: "https://cdn.example.com/source.mp4",
      sourceType: "douyin"
    }
  }, {
    ingestDouyinVideo: async () => ({ videoRef: "mediakit://file-1" })
  });

  assert.equal(result, "mediakit://file-1");
});

test("普通直链不触发中转", async () => {
  const result = await resolveSubmissionVideoRef({
    inputVideoRef: "https://cdn.example.com/source.mp4",
    resolvedVideo: {
      videoUrl: "https://cdn.example.com/source.mp4",
      sourceType: "direct"
    }
  }, {
    ingestDouyinVideo: async () => {
      throw new Error("should not run");
    }
  });

  assert.equal(result, "https://cdn.example.com/source.mp4");
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test app/api/jobs/route.test.mjs`
Expected: FAIL，提示 `resolveSubmissionVideoRef` 未导出

- [ ] **Step 3: 写最小实现**

```ts
import { ingestDouyinVideo } from "@/lib/douyin-ingest";

export async function resolveSubmissionVideoRef(
  input: {
    inputVideoRef: string;
    resolvedVideo: { videoUrl: string; sourceType: "direct" | "douyin"; sourceName?: string } | null;
  },
  deps: {
    ingestDouyinVideo?: typeof ingestDouyinVideo;
  } = {}
) {
  const runIngest = deps.ingestDouyinVideo ?? ingestDouyinVideo;
  if (!input.resolvedVideo || input.resolvedVideo.sourceType !== "douyin") {
    return input.inputVideoRef;
  }
  const ingested = await runIngest({
    sourceUrl: input.resolvedVideo.videoUrl,
    sourceName: input.resolvedVideo.sourceName ?? "douyin-video.mp4"
  });
  return ingested.videoRef;
}
```

```ts
const resolvedVideo = /^https?:\/\//.test(input.videoRef) && input.resolvedToken
  ? getResolvedVideo(input.resolvedToken, user.id, input.videoRef)
  : null;

const finalVideoRef = await resolveSubmissionVideoRef({
  inputVideoRef: input.videoRef,
  resolvedVideo: resolvedVideo
    ? {
        videoUrl: resolvedVideo.videoUrl,
        sourceType: resolvedVideo.sourceType,
        sourceName: resolvedVideo.sourceName
      }
    : null
});
```

```ts
db.prepare(`
  INSERT INTO jobs (id, user_id, source_name, video_ref, duration_estimate_sec, mode, options_json,
    reserved_points, status, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitting', ?, ?)
`).run(id, user.id, sourceName, finalVideoRef, verifiedDurationSeconds, input.mode, JSON.stringify(options), held, now, now);

const data = await submitEraseJob({
  mode: input.mode,
  videoRef: finalVideoRef,
  clientToken: id,
  eraseMode: input.eraseMode,
  encodeMode: input.encodeMode,
  regions: input.regions
});
```

- [ ] **Step 4: 再跑测试并确认通过**

Run: `node --test app/api/jobs/route.test.mjs`
Expected: PASS

- [ ] **Step 5: 跑类型检查**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add app/api/jobs/route.ts app/api/jobs/route.test.mjs
git commit -m "feat: ingest douyin videos at submit time"
```

### Task 4: 全链路回归验证

**Files:**
- Verify: `d:\TRAE\text clear\lib\volcengine.ts`
- Verify: `d:\TRAE\text clear\lib\douyin-ingest.ts`
- Verify: `d:\TRAE\text clear\app\api\jobs\route.ts`
- Verify: `d:\TRAE\text clear\app\api\video\resolve\route.ts`

- [ ] **Step 1: 跑针对性测试**

Run: `node --test lib/volcengine.test.mjs lib/douyin-ingest.test.mjs app/api/jobs/route.test.mjs`
Expected: PASS

- [ ] **Step 2: 跑现有相关回归测试**

Run: `node --test lib/resolved-video-cache.test.mjs lib/job-result.test.mjs lib/modal-close.test.mjs`
Expected: PASS

- [ ] **Step 3: 跑类型检查与生产构建**

Run: `npm run lint && npm run build`
Expected: PASS

- [ ] **Step 4: 手动验收**

```text
1. 粘贴一个抖音链接并点击解析
2. 确认解析成功，但此时不触发上传，也不产生 mediakit:// 引用
3. 点击“开始擦除”
4. 服务端开始下载并上传抖音源，随后提交字幕擦除任务
5. 任务进入 running 状态
6. 即使提交失败，服务器临时文件也被删除
7. 本地上传视频流程仍能正常处理
8. 普通公网直链流程仍能正常处理
```

- [ ] **Step 5: 提交**

```bash
git add lib/volcengine.ts lib/volcengine.test.mjs lib/douyin-ingest.ts lib/douyin-ingest.test.mjs app/api/jobs/route.ts app/api/jobs/route.test.mjs
git commit -m "feat: route douyin jobs through submit-time ingest"
```
