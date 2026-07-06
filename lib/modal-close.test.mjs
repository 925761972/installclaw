import test from "node:test";
import assert from "node:assert/strict";
import { blurTrigger, shouldCloseOnEscape } from "./modal-close.ts";

test("按下 Escape 时允许关闭弹窗", () => {
  assert.equal(shouldCloseOnEscape("Escape"), true);
});

test("其他按键不会关闭弹窗", () => {
  assert.equal(shouldCloseOnEscape("Enter"), false);
  assert.equal(shouldCloseOnEscape(" "), false);
});

test("关闭弹窗时会清除触发按钮焦点", () => {
  let blurred = 0;
  const trigger = {
    blur() {
      blurred += 1;
    }
  };

  blurTrigger(trigger);

  assert.equal(blurred, 1);
});

test("关闭弹窗时允许没有触发按钮引用", () => {
  assert.doesNotThrow(() => blurTrigger(null));
});
