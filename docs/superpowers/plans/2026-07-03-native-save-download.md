# Native Save Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为处理结果视频下载增加浏览器原生“另存为”能力，并在不支持时自动回退到当前下载方式。

**Architecture:** 继续保留现有前端下载入口 `downloadResult(job)`，但把下载实现拆到 `lib/job-result.ts`。新增一个原生保存函数，优先调用 `window.showSaveFilePicker` 将远程视频写入用户选定的位置；若能力不存在则回退到当前 `<a download>` 下载，保持兼容性。

**Tech Stack:** Next.js 16、React 19、TypeScript、浏览器 File System Access API、Node test runner

---

### Task 1: 扩展下载工具函数

**Files:**
- Modify: `d:\TRAE\text clear\lib\job-result.ts`
- Test: `d:\TRAE\text clear\lib\job-result.test.mjs`

- [ ] **Step 1: 写失败测试，定义默认文件名与扩展名辅助能力**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSavePickerOptions,
  deriveResultDownloadName,
  normalizeResultUrl
} from "./job-result.ts";

test("原生保存选项会保留建议文件名和 mp4 扩展名", () => {
  const options = buildSavePickerOptions("demo-input.mp4", "https://example.com/output.mp4?preview=1");
  assert.equal(options.suggestedName, "demo-input-clean.mp4");
  assert.deepEqual(options.types[0].accept, { "video/mp4": [".mp4"] });
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test lib/job-result.test.mjs`
Expected: FAIL，提示 `buildSavePickerOptions` 未导出或断言失败

- [ ] **Step 3: 最小实现辅助函数**

```ts
function getExtensionFromName(fileName: string) {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ".mp4";
}

function getMimeTypeForExtension(extension: string) {
  return extension === ".webm" ? "video/webm" : "video/mp4";
}

export function buildSavePickerOptions(sourceName: string, resultUrl: string) {
  const suggestedName = deriveResultDownloadName(sourceName, resultUrl);
  const extension = getExtensionFromName(suggestedName);
  const mimeType = getMimeTypeForExtension(extension);
  return {
    suggestedName,
    types: [
      {
        description: "视频文件",
        accept: {
          [mimeType]: [extension]
        }
      }
    ]
  };
}
```

- [ ] **Step 4: 再跑测试并确认通过**

Run: `node --test lib/job-result.test.mjs`
Expected: PASS，原有下载名测试和新增保存选项测试一起通过

- [ ] **Step 5: 提交**

```bash
git add lib/job-result.ts lib/job-result.test.mjs
git commit -m "feat: add native save picker options"
```

### Task 2: 实现原生另存为与普通下载回退

**Files:**
- Modify: `d:\TRAE\text clear\lib\job-result.ts`
- Test: `d:\TRAE\text clear\lib\job-result.test.mjs`

- [ ] **Step 1: 写失败测试，定义回退判断与取消行为**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { shouldFallbackToAnchorDownload, isSavePickerAbortError } from "./job-result.ts";

test("不支持原生保存能力时应回退为普通下载", () => {
  assert.equal(shouldFallbackToAnchorDownload(undefined), true);
});

test("AbortError 代表用户主动取消保存", () => {
  assert.equal(isSavePickerAbortError({ name: "AbortError" }), true);
  assert.equal(isSavePickerAbortError({ name: "TypeError" }), false);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test lib/job-result.test.mjs`
Expected: FAIL，提示 `shouldFallbackToAnchorDownload` 或 `isSavePickerAbortError` 未定义

- [ ] **Step 3: 最小实现原生保存核心逻辑**

```ts
export function shouldFallbackToAnchorDownload(
  showSaveFilePicker?: ((options?: unknown) => Promise<unknown>) | null
) {
  return typeof showSaveFilePicker !== "function";
}

export function isSavePickerAbortError(error: unknown) {
  return !!error && typeof error === "object" && "name" in error && error.name === "AbortError";
}

export async function saveResultWithPicker(
  sourceName: string,
  resultUrl: string,
  showSaveFilePicker: NonNullable<Window["showSaveFilePicker"]>
) {
  const response = await fetch(normalizeResultUrl(resultUrl));
  if (!response.ok) throw new Error(`下载失败（${response.status}）`);
  const blob = await response.blob();
  const handle = await showSaveFilePicker(buildSavePickerOptions(sourceName, resultUrl));
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
}

export function triggerAnchorDownload(sourceName: string, resultUrl: string) {
  const anchor = document.createElement("a");
  anchor.href = normalizeResultUrl(resultUrl);
  anchor.download = deriveResultDownloadName(sourceName, resultUrl);
  anchor.rel = "noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
```

- [ ] **Step 4: 再跑测试并确认通过**

Run: `node --test lib/job-result.test.mjs`
Expected: PASS，新增判断逻辑测试通过

- [ ] **Step 5: 提交**

```bash
git add lib/job-result.ts lib/job-result.test.mjs
git commit -m "feat: add native save download helpers"
```

### Task 3: 接入下载按钮并处理错误

**Files:**
- Modify: `d:\TRAE\text clear\components\dashboard-studio.tsx`
- Verify: `d:\TRAE\text clear\app\globals.css`

- [ ] **Step 1: 写出目标调用方式，先让 TypeScript 报错**

```ts
import {
  deriveResultDownloadName,
  isSavePickerAbortError,
  normalizeResultUrl,
  saveResultWithPicker,
  shouldFallbackToAnchorDownload,
  triggerAnchorDownload
} from "@/lib/job-result";
```

```ts
async function downloadResult(job: Job) {
  if (!job.result_url) return;

  try {
    if (shouldFallbackToAnchorDownload(window.showSaveFilePicker)) {
      triggerAnchorDownload(job.source_name, job.result_url);
      return;
    }

    await saveResultWithPicker(job.source_name, job.result_url, window.showSaveFilePicker);
  } catch (caught) {
    if (isSavePickerAbortError(caught)) return;
    setError(caught instanceof Error ? caught.message : "下载失败");
  }
}
```

- [ ] **Step 2: 运行类型检查并确认在未完整接入前有预期报错**

Run: `npm run lint`
Expected: FAIL，若导入或 `downloadResult` 还是旧同步签名则出现类型不匹配

- [ ] **Step 3: 完成最小接入**

```ts
async function downloadResult(job: Job) {
  if (!job.result_url) return;

  try {
    if (shouldFallbackToAnchorDownload(window.showSaveFilePicker)) {
      triggerAnchorDownload(job.source_name, job.result_url);
      return;
    }

    await saveResultWithPicker(job.source_name, job.result_url, window.showSaveFilePicker);
  } catch (caught) {
    if (isSavePickerAbortError(caught)) return;
    setError(caught instanceof Error ? caught.message : "下载失败");
  }
}
```

```tsx
<button className="download-button" onClick={() => void downloadResult(job)}>
  <Download size={15} />下载
</button>

<button className="button button-dark button-small" onClick={() => void downloadResult(previewJob)}>
  <Download size={15} />下载视频
</button>
```

- [ ] **Step 4: 跑类型检查并确认通过**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add components/dashboard-studio.tsx lib/job-result.ts lib/job-result.test.mjs
git commit -m "feat: use native save dialog for result download"
```

### Task 4: 最终验证

**Files:**
- Verify: `d:\TRAE\text clear\components\dashboard-studio.tsx`
- Verify: `d:\TRAE\text clear\lib\job-result.ts`
- Verify: `d:\TRAE\text clear\lib\job-result.test.mjs`

- [ ] **Step 1: 跑相关测试**

Run: `node --test lib/job-result.test.mjs lib/modal-close.test.mjs`
Expected: PASS

- [ ] **Step 2: 跑全量类型检查**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 3: 手动验证下载行为**

```text
1. 打开任务列表中的已完成任务
2. 点击“下载”
3. 在支持 showSaveFilePicker 的浏览器里，应弹出系统“另存为”窗口
4. 修改文件名并选择目录后保存，文件应能正常播放
5. 在不支持该能力的环境中，点击“下载”应直接触发普通下载
6. 点击保存窗口“取消”时，不应出现错误提示
```

- [ ] **Step 4: 提交**

```bash
git add components/dashboard-studio.tsx lib/job-result.ts lib/job-result.test.mjs
git commit -m "test: verify native save download flow"
```
