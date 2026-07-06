"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Pause, Play, RotateCcw, Trash2 } from "lucide-react";

export type EraseRegion = {
  top_left_x: number;
  top_left_y: number;
  bottom_right_x: number;
  bottom_right_y: number;
};

type Point = { x: number; y: number };
type Draft = { start: Point; end: Point };

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function roundRatio(value: number) {
  return Number(clamp(value).toFixed(4));
}

function draftToRegion(draft: Draft): EraseRegion {
  return {
    top_left_x: roundRatio(Math.min(draft.start.x, draft.end.x)),
    top_left_y: roundRatio(Math.min(draft.start.y, draft.end.y)),
    bottom_right_x: roundRatio(Math.max(draft.start.x, draft.end.x)),
    bottom_right_y: roundRatio(Math.max(draft.start.y, draft.end.y))
  };
}

function regionStyle(region: EraseRegion) {
  return {
    left: `${region.top_left_x * 100}%`,
    top: `${region.top_left_y * 100}%`,
    width: `${(region.bottom_right_x - region.top_left_x) * 100}%`,
    height: `${(region.bottom_right_y - region.top_left_y) * 100}%`
  };
}

function timeLabel(seconds: number) {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

export function RegionSelector({
  source,
  regions,
  onChange,
  eraseMode
}: {
  source: string | null;
  regions: EraseRegion[];
  onChange: (regions: EraseRegion[]) => void;
  eraseMode: "Subtitle" | "Text";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [videoError, setVideoError] = useState("");

  useEffect(() => {
    setPlaying(false);
    setDuration(0);
    setCurrentTime(0);
    setAspectRatio(16 / 9);
    setVideoError("");
  }, [source]);

  const draftRegion = useMemo(() => draft ? draftToRegion(draft) : null, [draft]);
  const hasUpperRegion = regions.some((region) => region.top_left_y < 0.5);

  function pointFromEvent(event: React.PointerEvent<HTMLDivElement>): Point {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height)
    };
  }

  function startDraw(event: React.PointerEvent<HTMLDivElement>) {
    if (!source || regions.length >= 20 || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    setDraft({ start: point, end: point });
    setDrawing(true);
    videoRef.current?.pause();
    setPlaying(false);
  }

  function moveDraw(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawing) return;
    const point = pointFromEvent(event);
    setDraft((current) => current ? { ...current, end: point } : current);
  }

  function finishDraw(event: React.PointerEvent<HTMLDivElement>) {
    if (!drawing || !draft) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const region = draftToRegion({ ...draft, end: pointFromEvent(event) });
    setDrawing(false);
    setDraft(null);
    if (region.bottom_right_x - region.top_left_x < 0.015 || region.bottom_right_y - region.top_left_y < 0.015) return;
    onChange([...regions, region]);
  }

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPlaying(true)).catch(() => setVideoError("浏览器无法播放该视频预览"));
    } else {
      video.pause();
      setPlaying(false);
    }
  }

  function seek(value: number) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(value)) return;
    video.currentTime = value;
    setCurrentTime(value);
  }

  if (!source) {
    return (
      <div className="region-empty">
        <Crosshair />
        <strong>先添加视频，再框选擦除区域</strong>
        <span>选择本地视频，或填写可预览的公网视频地址。</span>
      </div>
    );
  }

  return (
    <div className="region-selector">
      <div className="region-help">
        <div><Crosshair size={18} /><span><strong>在画面上按住并拖动</strong><small>可连续添加多个矩形，最多 20 个</small></span></div>
        <span className="region-count">{regions.length} / 20 个选区</span>
      </div>

      <div className="region-stage" data-testid="region-canvas" style={{ aspectRatio, maxWidth: aspectRatio < 1 ? `${Math.round(540 * aspectRatio)}px` : undefined }}>
        <video
          ref={videoRef}
          src={source}
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget;
            setDuration(video.duration || 0);
            if (video.videoWidth && video.videoHeight) setAspectRatio(video.videoWidth / video.videoHeight);
          }}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => setVideoError("视频无法预览，请检查格式或公网地址权限")}
        />
        <div
          ref={canvasRef}
          className={`region-canvas ${regions.length >= 20 ? "limit" : ""}`}
          onPointerDown={startDraw}
          onPointerMove={moveDraw}
          onPointerUp={finishDraw}
          onPointerCancel={() => { setDrawing(false); setDraft(null); }}
          aria-label="视频擦除区域框选画布"
        >
          {regions.map((region, index) => (
            <div className="erase-box" style={regionStyle(region)} key={`${index}-${region.top_left_x}-${region.top_left_y}`}>
              <span>{index + 1}</span>
            </div>
          ))}
          {draftRegion && <div className="erase-box draft" style={regionStyle(draftRegion)}><span>+</span></div>}
          {!regions.length && !drawing && <div className="draw-hint"><Crosshair size={17} />拖拽框选字幕或文字区域</div>}
        </div>
      </div>

      <div className="video-controls">
        <button type="button" onClick={togglePlayback} aria-label={playing ? "暂停预览" : "播放预览"}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
        <span>{timeLabel(currentTime)}</span>
        <input aria-label="预览时间" type="range" min="0" max={duration || 0} step="0.05" value={Math.min(currentTime, duration || 0)} onChange={(event) => seek(Number(event.target.value))} />
        <span>{timeLabel(duration)}</span>
        <button type="button" className="clear-regions" disabled={!regions.length} onClick={() => onChange([])}><RotateCcw size={14} />清空选区</button>
      </div>
      {videoError && <p className="region-warning error">{videoError}</p>}
      {eraseMode === "Subtitle" && <p className={`region-warning ${hasUpperRegion ? "attention" : ""}`}>“仅字幕”模式只处理画面下半部分，选区会与下半画面取交集。要擦除上半画面的人名、地名等，请将“识别内容”切换为“画面文本”。</p>}

      {!!regions.length && <div className="region-list">
        {regions.map((region, index) => (
          <div className="region-chip" key={`chip-${index}`}>
            <b>选区 {index + 1}</b>
            <span>X {region.top_left_x.toFixed(3)}–{region.bottom_right_x.toFixed(3)}</span>
            <span>Y {region.top_left_y.toFixed(3)}–{region.bottom_right_y.toFixed(3)}</span>
            <button type="button" aria-label={`删除选区 ${index + 1}`} onClick={() => onChange(regions.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={13} /></button>
          </div>
        ))}
      </div>}
    </div>
  );
}
