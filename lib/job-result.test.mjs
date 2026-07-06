import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSavePickerOptions,
  deriveResultDownloadName,
  isSavePickerAbortError,
  normalizeResultUrl,
  saveResultWithPicker,
  shouldFallbackToAnchorDownload,
  triggerAnchorDownload
} from "./job-result.ts";

test("会移除火山结果链接中的 preview 参数", () => {
  const url = normalizeResultUrl("https://example.com/video?id=1&preview=1&auth_key=abc");
  assert.equal(url, "https://example.com/video?id=1&auth_key=abc");
});

test("会保留其他查询参数", () => {
  const url = normalizeResultUrl("https://example.com/video?preview=1&x=1&y=2");
  assert.equal(url, "https://example.com/video?x=1&y=2");
});

test("下载文件名优先使用原始文件名并保留 mp4 后缀", () => {
  assert.equal(
    deriveResultDownloadName("demo-input.mp4", "https://example.com/output?auth_key=1"),
    "demo-input-clean.mp4"
  );
});

test("下载文件名会为无后缀源文件补上 mp4", () => {
  assert.equal(
    deriveResultDownloadName("demo-input", "https://example.com/output?auth_key=1"),
    "demo-input-clean.mp4"
  );
});

test("原生保存选项会保留建议文件名和 mp4 扩展名", () => {
  const options = buildSavePickerOptions(
    "demo-input.mp4",
    "https://example.com/output.mp4?preview=1"
  );

  assert.equal(options.suggestedName, "demo-input-clean.mp4");
  assert.deepEqual(options.types[0].accept, { "video/mp4": [".mp4"] });
});

test("不支持原生保存能力时应回退为普通下载", () => {
  assert.equal(shouldFallbackToAnchorDownload(undefined), true);
  assert.equal(shouldFallbackToAnchorDownload(null), true);
  assert.equal(shouldFallbackToAnchorDownload(async () => ({})), false);
});

test("AbortError 代表用户主动取消保存", () => {
  assert.equal(isSavePickerAbortError({ name: "AbortError" }), true);
  assert.equal(isSavePickerAbortError({ name: "TypeError" }), false);
  assert.equal(isSavePickerAbortError(null), false);
});

test("原生保存会拉取规范化后的链接并写入用户选择的位置", async () => {
  const originalFetch = globalThis.fetch;
  const blob = new Blob(["video-data"], { type: "video/mp4" });
  let fetchedUrl;
  let pickerOptions;
  let writtenBlob;
  let closed = false;

  globalThis.fetch = async (url) => {
    fetchedUrl = url;
    return {
      ok: true,
      blob: async () => blob
    };
  };

  try {
    await saveResultWithPicker(
      "demo-input.mp4",
      "https://example.com/output.mp4?preview=1&auth_key=abc",
      async (options) => {
        pickerOptions = options;
        return {
          createWritable: async () => ({
            write: async (value) => {
              writtenBlob = value;
            },
            close: async () => {
              closed = true;
            }
          })
        };
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(fetchedUrl, "https://example.com/output.mp4?auth_key=abc");
  assert.equal(pickerOptions.suggestedName, "demo-input-clean.mp4");
  assert.equal(writtenBlob, blob);
  assert.equal(closed, true);
});

test("普通下载会创建带建议文件名的锚点并触发点击", () => {
  const originalDocument = globalThis.document;
  const appended = [];
  let anchor;

  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, "a");
      anchor = {
        clickCalled: false,
        removed: false,
        click() {
          this.clickCalled = true;
        },
        remove() {
          this.removed = true;
        }
      };
      return anchor;
    },
    body: {
      appendChild(node) {
        appended.push(node);
      }
    }
  };

  try {
    triggerAnchorDownload(
      "demo-input.mp4",
      "https://example.com/output.mp4?preview=1&auth_key=abc"
    );
  } finally {
    globalThis.document = originalDocument;
  }

  assert.equal(appended[0], anchor);
  assert.equal(anchor.href, "https://example.com/output.mp4?auth_key=abc");
  assert.equal(anchor.download, "demo-input-clean.mp4");
  assert.equal(anchor.rel, "noreferrer");
  assert.equal(anchor.clickCalled, true);
  assert.equal(anchor.removed, true);
});
