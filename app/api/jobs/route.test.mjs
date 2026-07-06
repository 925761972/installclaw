import test from "node:test";
import assert from "node:assert/strict";
import { POST } from "./route.ts";

test("抖音来源在提交阶段会先转成 mediakit 引用", async () => {
  const result = await POST.resolveSubmissionVideoRef({
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
  const result = await POST.resolveSubmissionVideoRef({
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
