import test from "node:test";
import assert from "node:assert/strict";
import {
  estimateProcessingRangeSeconds,
  formatEtaWindow,
  getJobTimingHint
} from "./job-timing.ts";

test("长视频按官方 RTF 6-10 返回区间估算", () => {
  const range = estimateProcessingRangeSeconds(120);
  assert.deepEqual(range, { minSeconds: 720, maxSeconds: 1200 });
});

test("短视频按官方 RTF 25 返回单点估算", () => {
  const range = estimateProcessingRangeSeconds(42);
  assert.deepEqual(range, { minSeconds: 1050, maxSeconds: 1050 });
});

test("运行中任务显示剩余时间区间", () => {
  const hint = getJobTimingHint({
    status: "running",
    durationEstimateSec: 120,
    createdAt: 0,
    updatedAt: 0,
    now: 180000
  });
  assert.equal(hint, "预计还需 9-17 分钟");
});

test("短视频运行中任务显示约剩余时间", () => {
  const hint = getJobTimingHint({
    status: "running",
    durationEstimateSec: 42,
    createdAt: 0,
    updatedAt: 0,
    now: 120000
  });
  assert.equal(hint, "预计还需约 15 分钟");
});

test("完成任务显示实际耗时", () => {
  const hint = getJobTimingHint({
    status: "completed",
    durationEstimateSec: 42,
    createdAt: 0,
    updatedAt: 125000,
    now: 180000
  });
  assert.equal(hint, "实际耗时 2 分钟");
});

test("超过预估上限后提示仍在继续", () => {
  const hint = getJobTimingHint({
    status: "running",
    durationEstimateSec: 120,
    createdAt: 0,
    updatedAt: 0,
    now: 1300000
  });
  assert.equal(hint, "处理时间超出预估，仍在继续");
});

test("提交中任务显示固定文案", () => {
  const hint = getJobTimingHint({
    status: "submitting",
    durationEstimateSec: 120,
    createdAt: 0,
    updatedAt: 0,
    now: 1000
  });
  assert.equal(hint, "正在提交任务");
});

test("格式化区间文案时相同上下限返回约值", () => {
  assert.equal(formatEtaWindow(600, 600), "预计还需约 10 分钟");
});

