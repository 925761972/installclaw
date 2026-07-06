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
