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
