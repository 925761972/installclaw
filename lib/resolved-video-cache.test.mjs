import test from "node:test";
import assert from "node:assert/strict";
import { getResolvedVideo, registerResolvedVideo } from "./resolved-video-cache.ts";

test("已解析 URL 可在提交阶段重复复用服务端时长", () => {
  const token = registerResolvedVideo({
    userId: "user-1",
    videoUrl: "https://example.com/video.mp4",
    durationSeconds: 42,
    sourceName: "demo",
    sourceType: "direct"
  });

  const resolved = getResolvedVideo(token, "user-1", "https://example.com/video.mp4");
  assert.ok(resolved);
  assert.equal(resolved?.durationSeconds, 42);

  const again = getResolvedVideo(token, "user-1", "https://example.com/video.mp4");
  assert.ok(again);
  assert.equal(again?.durationSeconds, 42);
});

test("resolved token 必须匹配用户和视频地址", () => {
  const token = registerResolvedVideo({
    userId: "user-1",
    videoUrl: "https://example.com/video.mp4",
    durationSeconds: 42,
    sourceName: "demo",
    sourceType: "direct"
  });

  assert.equal(getResolvedVideo(token, "user-2", "https://example.com/video.mp4"), null);
  assert.equal(getResolvedVideo(token, "user-1", "https://example.com/other.mp4"), null);
});

