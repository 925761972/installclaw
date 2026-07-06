type TimingInput = {
  status: string;
  durationEstimateSec: number;
  createdAt: number;
  updatedAt: number;
  now?: number;
};

export function estimateProcessingRangeSeconds(durationEstimateSec: number) {
  if (durationEstimateSec < 60) {
    const seconds = Math.max(1, Math.round(durationEstimateSec * 25));
    return { minSeconds: seconds, maxSeconds: seconds };
  }
  return {
    minSeconds: Math.max(1, Math.round(durationEstimateSec * 6)),
    maxSeconds: Math.max(1, Math.round(durationEstimateSec * 10))
  };
}

function formatRoundedDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.floor(seconds))} 秒`;
  const minutes = Math.max(1, Math.floor(seconds / 60));
  return `${minutes} 分钟`;
}

export function formatEtaWindow(minSeconds: number, maxSeconds: number) {
  if (minSeconds === maxSeconds) return `预计还需约 ${formatRoundedDuration(minSeconds)}`;
  if (minSeconds < 60 && maxSeconds < 60) {
    return `预计还需 ${Math.max(1, Math.floor(minSeconds))}-${Math.max(1, Math.floor(maxSeconds))} 秒`;
  }
  return `预计还需 ${Math.max(1, Math.floor(minSeconds / 60))}-${Math.max(1, Math.floor(maxSeconds / 60))} 分钟`;
}

export function getJobTimingHint(input: TimingInput) {
  const now = input.now ?? Date.now();
  if (input.status === "submitting") return "正在提交任务";

  if (input.status === "running") {
    const startedAt = input.updatedAt || input.createdAt;
    const elapsedSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
    const range = estimateProcessingRangeSeconds(input.durationEstimateSec);
    if (elapsedSeconds >= range.maxSeconds) return "处理时间超出预估，仍在继续";
    return formatEtaWindow(
      Math.max(0, range.minSeconds - elapsedSeconds),
      Math.max(0, range.maxSeconds - elapsedSeconds)
    );
  }

  if (input.status === "completed") {
    const actualSeconds = Math.max(1, Math.floor((input.updatedAt - input.createdAt) / 1000));
    return `实际耗时 ${formatRoundedDuration(actualSeconds)}`;
  }

  return null;
}
