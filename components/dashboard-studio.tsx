"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Coins, Download, ExternalLink, FileVideo, Link2, LoaderCircle, LogOut, Play, RefreshCw, Sparkles, UploadCloud, WandSparkles, X, XCircle } from "lucide-react";
import { getJobTimingHint } from "@/lib/job-timing";
import { blurTrigger, shouldCloseOnEscape } from "@/lib/modal-close";
import {
  isSavePickerAbortError,
  normalizeResultUrl,
  saveResultWithPicker,
  shouldFallbackToAnchorDownload,
  triggerAnchorDownload
} from "@/lib/job-result";
import { PRICING, reservePoints, usagePoints, type EraseMode } from "@/lib/pricing";
import { RegionSelector, type EraseRegion } from "@/components/region-selector";

type User = { email: string; points_balance: number };
type RechargePrompt = { balance: number; requiredPoints: number; shortage: number };
type UrlResolution = { videoUrl: string; previewUrl: string; resolvedToken: string; durationSeconds: number; sourceName: string; sourceType: "direct" | "douyin" };
type Job = {
  id: string; source_name: string; duration_estimate_sec: number; mode: EraseMode; reserved_points: number;
  final_points: number | null; status: string; result_url: string | null; provider_error: string | null; created_at: number; updated_at: number;
};
type BrowserWindowWithSavePicker = Window & typeof globalThis & {
  showSaveFilePicker?: Parameters<typeof saveResultWithPicker>[2];
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function jobHint(job: Job) {
  return getJobTimingHint({
    status: job.status,
    durationEstimateSec: job.duration_estimate_sec,
    createdAt: job.created_at,
    updatedAt: job.updated_at
  });
}

const STATUS: Record<string, string> = {
  submitting: "正在提交", running: "智能擦除中", completed: "处理完成", failed: "处理失败", submit_failed: "提交失败"
};

export function DashboardStudio() {
  const [user, setUser] = useState<User | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sourceType, setSourceType] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [urlResolution, setUrlResolution] = useState<UrlResolution | null>(null);
  const [resolvingUrl, setResolvingUrl] = useState(false);
  const [duration, setDuration] = useState(0);
  const [mode, setMode] = useState<EraseMode>("standard");
  const [eraseMode, setEraseMode] = useState<"Subtitle" | "Text">("Subtitle");
  const [encodeMode, setEncodeMode] = useState<"Quality" | "Size">("Quality");
  const [regions, setRegions] = useState<EraseRegion[]>([]);
  const [advanced, setAdvanced] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [rechargePrompt, setRechargePrompt] = useState<RechargePrompt | null>(null);
  const [previewJob, setPreviewJob] = useState<Job | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null);
  const resolveSequenceRef = useRef(0);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => { setRechargePrompt(null); }, [duration, mode, videoUrl, file]);

  const load = useCallback(async () => {
    const response = await fetch("/api/me", { cache: "no-store" });
    if (response.status === 401) return (window.location.href = "/login");
    const data = await response.json();
    setUser(data.user);
    setJobs(data.jobs);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (sourceType !== "url" || !/https?:\/\//i.test(videoUrl)) return;
    const timer = window.setTimeout(() => { void resolveUrl(videoUrl, true); }, 800);
    return () => window.clearTimeout(timer);
  }, [videoUrl, sourceType]);

  useEffect(() => {
    const running = jobs.filter((job) => ["running", "submitting"].includes(job.status));
    if (!running.length) return;
    const timer = window.setInterval(async () => {
      await Promise.all(running.map((job) => fetch(`/api/jobs/${job.id}`, { cache: "no-store" })));
      await load();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [jobs, load]);

  useEffect(() => {
    if (!previewJob) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (shouldCloseOnEscape(event.key)) closePreview();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewJob]);

  const estimate = useMemo(() => duration > 0 ? usagePoints(duration, mode) : 0, [duration, mode]);
  const held = useMemo(() => duration > 0 ? reservePoints(duration, mode) : 0, [duration, mode]);
  const clientRechargePrompt = user && held > user.points_balance
    ? { balance: user.points_balance, requiredPoints: held, shortage: held - user.points_balance }
    : null;
  const visibleRechargePrompt = rechargePrompt ?? clientRechargePrompt;
  const previewSource = sourceType === "file" ? previewUrl : urlResolution?.previewUrl ?? null;

  function pickFile(selected?: File) {
    if (!selected) return;
    setFile(selected);
    setRegions([]);
    setError("");
    const objectUrl = URL.createObjectURL(selected);
    setPreviewUrl(objectUrl);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (Number.isFinite(video.duration)) setDuration(video.duration);
    };
    video.src = objectUrl;
  }

  async function resolveUrl(value = videoUrl, silent = false) {
    const sequence = ++resolveSequenceRef.current;
    setResolvingUrl(true);
    setUrlResolution(null);
    setDuration(0);
    if (!silent) setError("");
    try {
      const response = await fetch("/api/video/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "视频链接解析失败");
      if (sequence !== resolveSequenceRef.current) return null;
      const resolution = data as UrlResolution;
      setUrlResolution(resolution);
      setDuration(resolution.durationSeconds);
      setError("");
      return resolution;
    } catch (caught) {
      if (sequence === resolveSequenceRef.current && !silent) setError(caught instanceof Error ? caught.message : "视频链接解析失败");
      return null;
    } finally {
      if (sequence === resolveSequenceRef.current) setResolvingUrl(false);
    }
  }

  async function submit() {
    setError("");
    setRechargePrompt(null);
    if (sourceType === "file" && !file) return setError("请选择视频文件");
    if (sourceType === "file" && (!duration || duration <= 0)) return setError("暂时无法读取该视频时长，请换一个视频文件");
    if (sourceType === "url" && !/https?:\/\//i.test(videoUrl)) return setError("请粘贴公网视频直链或抖音分享链接");
    if (!user) return setError("账户信息加载中，请稍后重试");
    setBusy(true);
    try {
      let videoRef = videoUrl;
      let sourceName = videoUrl.split("/").pop() || "网络视频";
      let verifiedEstimate = duration;
      let resolvedToken: string | undefined;
      if (sourceType === "url") {
        setProgress("正在解析视频链接…");
        const resolution = urlResolution ?? await resolveUrl(videoUrl);
        if (!resolution) return;
        videoRef = resolution.videoUrl;
        sourceName = resolution.sourceName;
        verifiedEstimate = resolution.durationSeconds;
        resolvedToken = resolution.resolvedToken;
      }
      if (sourceType === "file" && file) {
        setProgress("正在获取安全上传地址…");
        const intentResponse = await fetch("/api/upload-intent", { method: "POST" });
        const intent = await intentResponse.json();
        if (!intentResponse.ok) throw new Error(intent.error || "上传初始化失败");
        setProgress("正在直传视频…");
        const headers: Record<string, string> = {};
        for (const item of intent.upload_headers || []) headers[item.key] = item.value;
        if (!headers["Content-Type"] && file.type) headers["Content-Type"] = file.type;
        const uploadResponse = await fetch(intent.upload_url, { method: intent.method || "PUT", headers, body: file });
        if (!uploadResponse.ok) throw new Error(`视频上传失败（${uploadResponse.status}）`);
        videoRef = String(intent.file_id).startsWith("mediakit://") ? intent.file_id : `mediakit://${intent.file_id}`;
        sourceName = file.name;
      }
      setProgress("正在核验真实时长并冻结积分…");
      const response = await fetch("/api/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoRef, sourceName, durationSeconds: verifiedEstimate, resolvedToken, mode,
          eraseMode: mode === "pro" ? eraseMode : undefined,
          encodeMode: mode === "pro" ? encodeMode : undefined,
          regions: mode === "pro" && regions.length ? regions : undefined
        })
      });
      const data = await response.json();
      if (response.status === 402 && data.code === "INSUFFICIENT_POINTS") {
        setRechargePrompt({ balance: data.balance, requiredPoints: data.requiredPoints, shortage: data.shortage });
        await load();
        return;
      }
      if (!response.ok) throw new Error(data.error || "任务创建失败");
      setFile(null); setPreviewUrl(null); setVideoUrl(""); setUrlResolution(null); setDuration(0); setRegions([]); setProgress("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "提交失败");
    } finally {
      setBusy(false); setProgress("");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  function previewResult(job: Job, trigger?: HTMLButtonElement | null) {
    if (!job.result_url) return;
    previewTriggerRef.current = trigger ?? null;
    setPreviewJob(job);
  }

  function closePreview() {
    setPreviewJob(null);
    blurTrigger(previewTriggerRef.current);
    previewTriggerRef.current = null;
  }

  async function downloadResult(job: Job) {
    if (!job.result_url) return;
    const showSaveFilePicker = (window as BrowserWindowWithSavePicker).showSaveFilePicker;

    try {
      if (!showSaveFilePicker || shouldFallbackToAnchorDownload(showSaveFilePicker)) {
        triggerAnchorDownload(job.source_name, job.result_url);
        return;
      }

      await saveResultWithPicker(job.source_name, job.result_url, showSaveFilePicker);
    } catch (caught) {
      if (isSavePickerAbortError(caught)) {
        return;
      }

      setError(caught instanceof Error ? caught.message : "下载失败");
    }
  }

  return (
    <main className="dashboard-shell">
      <aside className="dash-side">
        <a className="brand brand-light" href="/"><span className="brand-mark"><i /><i /><i /></span><span>净幕</span></a>
        <div className="side-user"><span>{user?.email?.slice(0, 1).toUpperCase() || "·"}</span><div><small>当前账号</small><p>{user?.email || "加载中"}</p></div></div>
        <nav><a className="active" href="#studio"><WandSparkles size={18} />字幕擦除</a><a href="#jobs"><FileVideo size={18} />任务记录</a><a href="/pricing"><Coins size={18} />充值积分</a></nav>
        <div className="side-balance"><small>可用积分</small><strong>{user?.points_balance.toLocaleString() ?? "—"}</strong><a href="/pricing">充值 <ExternalLink size={13} /></a></div>
        <button className="side-logout" onClick={logout}><LogOut size={16} />退出登录</button>
      </aside>

      <section className="dash-main">
        <div className="dash-heading" id="studio"><div><span className="eyebrow">AI VIDEO CLEANUP</span><h1>开始一次干净的擦除</h1><p>上传视频，选择效果。剩下的交给我们。</p></div><div className="secure-note"><i /> API 密钥全程仅在服务端使用</div></div>

        <div className="studio-layout">
          <div className="studio-card">
            <div className="step-title"><span>01</span><div><h2>添加视频</h2><p>支持本地文件或公网视频地址</p></div></div>
            <div className="tab-switch"><button className={sourceType === "file" ? "active" : ""} onClick={() => { setSourceType("file"); setRegions([]); }}><UploadCloud size={16} />本地上传</button><button className={sourceType === "url" ? "active" : ""} onClick={() => { setSourceType("url"); setRegions([]); }}><Link2 size={16} />视频地址 / 抖音</button></div>
            {sourceType === "file" ? (
              <div className={`drop-zone ${file ? "has-file" : ""}`} onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pickFile(e.dataTransfer.files[0]); }}>
                <input ref={inputRef} type="file" accept="video/*,.mkv,.flv,.ts,.avi,.wmv" hidden onChange={(e) => pickFile(e.target.files?.[0])} />
                {file ? <><FileVideo size={34} /><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(1)} MB · {duration ? formatDuration(duration) : "读取时长中…"}</span></> : <><UploadCloud size={34} /><strong>拖入视频，或点击选择</strong><span>MP4、MOV、MKV、AVI 等主流格式 · 输入最高 2K</span></>}
              </div>
            ) : (
              <div className="url-resolver"><label>公网视频直链或抖音分享链接<div className="url-input-row"><input value={videoUrl} onChange={(e) => { resolveSequenceRef.current += 1; setVideoUrl(e.target.value); setUrlResolution(null); setDuration(0); setRegions([]); setError(""); }} placeholder="粘贴 https://... 或整段抖音分享口令" /><button onClick={() => void resolveUrl()} disabled={resolvingUrl || !videoUrl.trim()}>{resolvingUrl ? <LoaderCircle className="spin" /> : <Link2 />}{resolvingUrl ? "解析中" : "解析视频"}</button></div></label>{urlResolution && <div className="resolve-success"><CheckCircle2 /><span><strong>{urlResolution.sourceType === "douyin" ? "抖音视频解析成功" : "视频解析成功"}</strong><small>{formatDuration(urlResolution.durationSeconds)} · 已自动计算费用</small></span></div>}<p>粘贴后会自动解析，无需手动填写时长；抖音作品需为公开可访问状态。</p></div>
            )}

            <div className="section-rule" />
            <div className="step-title"><span>02</span><div><h2>选择擦除模式</h2><p>两种模式都按实际输出时长计费</p></div></div>
            <div className="mode-grid">
              <button className={`mode-card ${mode === "standard" ? "selected" : ""}`} onClick={() => setMode("standard")}><span className="radio-dot" /><div className="mode-icon standard"><WandSparkles /></div><h3>标准版</h3><p>快速识别画面硬字幕，适合背景简单、批量处理。</p><strong>{PRICING.rates.standard} 积分 <small>/ 分钟</small></strong><span className="mode-tag">性价比优先</span></button>
              <button className={`mode-card ${mode === "pro" ? "selected" : ""}`} onClick={() => { setMode("pro"); setAdvanced(true); }}><span className="radio-dot" /><div className="mode-icon pro"><Sparkles /></div><h3>精细化版</h3><p>时序分析与画面重建，可在视频画面上框选擦除区域。</p><strong>{PRICING.rates.pro} 积分 <small>/ 分钟</small></strong><span className="mode-tag coral">支持框选</span></button>
            </div>

            {mode === "pro" && <>
              <div className="advanced">
                <button className="advanced-toggle" onClick={() => setAdvanced(!advanced)}>精细化设置 <ChevronDown className={advanced ? "rotate" : ""} size={17} /></button>
                {advanced && <div className="advanced-body">
                  <label>识别内容<select value={eraseMode} onChange={(e) => setEraseMode(e.target.value as "Subtitle" | "Text")}><option value="Subtitle">仅字幕（只处理画面下半部分）</option><option value="Text">画面文本（支持全画面任意选区）</option></select></label>
                  <label>输出偏好<select value={encodeMode} onChange={(e) => setEncodeMode(e.target.value as "Quality" | "Size")}><option value="Quality">画质优先</option><option value="Size">文件大小优先</option></select></label>
                </div>}
              </div>
              <div className="section-rule" />
              <div className="step-title region-step-title"><span>03</span><div><h2>框选擦除区域 <small>可选</small></h2><p>暂停到任意画面，拖动鼠标或手指框选；不框选则自动检测。</p></div></div>
              <RegionSelector source={previewSource} regions={regions} onChange={setRegions} eraseMode={eraseMode} />
            </>}
          </div>

          <aside className="order-summary">
            <span className="eyebrow">本次任务</span><h2>费用预估</h2>
            <div className="estimate"><strong>{estimate.toLocaleString()}</strong><span>积分</span></div>
            <dl><div><dt>处理模式</dt><dd>{mode === "pro" ? "精细化版" : "标准版"}</dd></div><div><dt>视频时长</dt><dd>{duration ? formatDuration(duration) : "待识别"}</dd></div>{mode === "pro" && <div><dt>指定选区</dt><dd>{regions.length ? `${regions.length} 个` : "自动检测"}</dd></div>}<div><dt>单价</dt><dd>{PRICING.rates[mode]} 积分/分钟</dd></div><div><dt>预计冻结</dt><dd>{held ? `${held} 积分` : "—"}</dd></div></dl>
            <p className="settle-note">服务端按视频真实时长计算并冻结应付积分，不增加安全余量；冻结成功后才会调用擦除 API。</p>
            {visibleRechargePrompt && <div className="recharge-warning"><strong>{rechargePrompt ? "积分不足，任务不会提交" : "按当前时长预估积分不足"}</strong><span>当前 {visibleRechargePrompt.balance.toLocaleString()} 积分，需冻结 {visibleRechargePrompt.requiredPoints.toLocaleString()} 积分，还差 {visibleRechargePrompt.shortage.toLocaleString()} 积分。</span>{rechargePrompt ? <a href="/pricing">立即充值 <ExternalLink size={13} /></a> : <small>你仍可提交，系统会按视频真实时长重新核验。</small>}</div>}
            {error && <p className="form-error compact">{error}</p>}
            <button className="button button-primary button-full start-button" onClick={submit} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <WandSparkles />}{progress || (clientRechargePrompt ? "核验真实时长" : "开始擦除")}</button>
            <p className="terms-note">提交即表示你确认拥有该视频的合法处理权利</p>
          </aside>
        </div>

        <section className="jobs-section" id="jobs">
          <div className="jobs-heading"><div><span className="eyebrow">RECENT TASKS</span><h2>最近任务</h2></div><button className="icon-text-button" onClick={load}><RefreshCw size={15} />刷新</button></div>
          <div className="jobs-table">
            {jobs.length === 0 ? <div className="empty-jobs"><FileVideo /><h3>还没有处理记录</h3><p>你的第一个干净画面，会从这里开始。</p></div> : jobs.map((job) => {
              const timing = jobHint(job);
              return <article className="job-row" key={job.id}>
                <div className={`job-status-icon ${job.status}`}>{job.status === "completed" ? <CheckCircle2 /> : ["failed", "submit_failed"].includes(job.status) ? <XCircle /> : <LoaderCircle className="spin" />}</div>
                <div className="job-name"><strong>{job.source_name}</strong><span>{new Date(job.created_at).toLocaleString("zh-CN")} · {formatDuration(job.duration_estimate_sec)}</span>{timing && <small>{timing}</small>}{job.provider_error && <small>{job.provider_error}</small>}</div>
                <span className={`status-badge ${job.status}`}>{STATUS[job.status] || job.status}</span>
                <span className="job-mode">{job.mode === "pro" ? "精细化" : "标准版"}</span>
                <span className="job-cost">{job.final_points ?? job.reserved_points} 积分</span>
                {job.result_url ? <div className="job-actions"><button className="preview-button" onClick={(event) => previewResult(job, event.currentTarget)}><Play size={15} />预览</button><button className="download-button" onClick={() => void downloadResult(job)}><Download size={15} />下载</button></div> : <span className="download-placeholder">—</span>}
              </article>;
            })}
          </div>
        </section>
      </section>
      {previewJob?.result_url && <div className="modal-backdrop" onClick={closePreview}>
        <div className="result-modal" onClick={(e) => e.stopPropagation()}>
          <button className="icon-button result-close-button" onClick={closePreview} aria-label="关闭预览"><X size={18} /></button>
          <div className="result-modal-head">
            <div className="result-modal-meta">
              <small>处理结果预览</small>
              <h3>{previewJob.source_name}</h3>
            </div>
            <button className="button button-dark button-small" onClick={() => void downloadResult(previewJob)}><Download size={15} />下载视频</button>
          </div>
          <video className="result-video" src={normalizeResultUrl(previewJob.result_url)} controls autoPlay playsInline preload="metadata" />
        </div>
      </div>}
    </main>
  );
}
