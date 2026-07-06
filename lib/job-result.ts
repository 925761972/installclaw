export function normalizeResultUrl(resultUrl: string) {
  const url = new URL(resultUrl);
  url.searchParams.delete("preview");
  return url.toString();
}

export function deriveResultDownloadName(sourceName: string, resultUrl: string) {
  const baseName = sourceName.replace(/\.[^.]+$/, "") || "processed-video";
  const normalized = normalizeResultUrl(resultUrl);
  const pathname = new URL(normalized).pathname;
  const extension = pathname.includes(".") ? pathname.slice(pathname.lastIndexOf(".")) : ".mp4";
  return `${baseName}-clean${extension || ".mp4"}`;
}

function getExtensionFromName(fileName: string) {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex >= 0 ? fileName.slice(dotIndex).toLowerCase() : ".mp4";
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

type SaveFilePicker = (options: ReturnType<typeof buildSavePickerOptions>) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

export function shouldFallbackToAnchorDownload(showSaveFilePicker?: SaveFilePicker | null) {
  return typeof showSaveFilePicker !== "function";
}

export function isSavePickerAbortError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return (error as { name?: unknown }).name === "AbortError";
}

export async function saveResultWithPicker(
  sourceName: string,
  resultUrl: string,
  showSaveFilePicker: SaveFilePicker
) {
  const response = await fetch(normalizeResultUrl(resultUrl));

  if (!response.ok) {
    throw new Error(`下载失败（${response.status}）`);
  }

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
