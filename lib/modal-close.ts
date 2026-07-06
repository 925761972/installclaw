export function shouldCloseOnEscape(key: string) {
  return key === "Escape";
}

type BlurTarget = { blur?: () => void } | null | undefined;

export function blurTrigger(target: BlurTarget) {
  target?.blur?.();
}
