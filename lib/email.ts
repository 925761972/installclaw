import { Resend } from "resend";
import { db } from "./db";
import { randomInt } from "node:crypto";

const CODE_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const MIN_RESEND_INTERVAL_MS = 60 * 1000;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function generateCode() {
  return randomInt(100000, 999999).toString();
}

export function canSendCode(email: string): { ok: boolean; waitSeconds?: number; error?: string } {
  const existing = db.prepare("SELECT created_at FROM email_verifications WHERE email = ?").get(email.toLowerCase()) as { created_at: number } | undefined;
  if (existing) {
    const elapsed = Date.now() - existing.created_at;
    if (elapsed < MIN_RESEND_INTERVAL_MS) {
      return { ok: false, waitSeconds: Math.ceil((MIN_RESEND_INTERVAL_MS - elapsed) / 1000), error: "发送太频繁，请稍后再试" };
    }
  }
  return { ok: true };
}

export async function sendVerificationCode(email: string): Promise<{ ok: boolean; error?: string; devMode?: boolean; devCode?: string }> {
  const normalizedEmail = email.toLowerCase();

  const canSend = canSendCode(normalizedEmail);
  if (!canSend.ok) return { ok: false, error: canSend.error };

  const code = generateCode();
  const now = Date.now();
  const expiresAt = now + CODE_EXPIRY_MS;

  db.prepare(`
    INSERT INTO email_verifications (email, code, expires_at, attempts, created_at)
    VALUES (?, ?, ?, 0, ?)
    ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, attempts = 0, created_at = excluded.created_at
  `).run(normalizedEmail, code, expiresAt, now);

  const resend = getResendClient();
  if (!resend) {
    return { ok: true, devMode: true, devCode: code };
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "verify@installclaw.cn";
    await resend.emails.send({
      from: `净幕 <${fromEmail}>`,
      to: normalizedEmail,
      subject: "净幕 - 邮箱验证码",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
          <h2 style="color: #191919; margin-bottom: 24px;">邮箱验证码</h2>
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
            你正在注册净幕账号，你的验证码是：
          </p>
          <div style="background: #f5f5f5; padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 32px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #07c160;">${code}</span>
          </div>
          <p style="color: #999; font-size: 14px; line-height: 1.6;">
            验证码 10 分钟内有效，请勿泄露给他人。<br>
            如果这不是你的操作，请忽略此邮件。
          </p>
        </div>
      `
    });
    return { ok: true };
  } catch (error) {
    console.error("Failed to send verification email:", error);
    return { ok: false, error: "邮件发送失败，请稍后重试" };
  }
}

export function verifyCode(email: string, code: string): { ok: boolean; error?: string } {
  const normalizedEmail = email.toLowerCase();
  const record = db.prepare("SELECT code, expires_at, attempts FROM email_verifications WHERE email = ?").get(normalizedEmail) as { code: string; expires_at: number; attempts: number } | undefined;

  if (!record) return { ok: false, error: "请先获取验证码" };
  if (Date.now() > record.expires_at) return { ok: false, error: "验证码已过期，请重新获取" };
  if (record.attempts >= MAX_ATTEMPTS) return { ok: false, error: "验证次数过多，请重新获取验证码" };

  const isValid = record.code === code.trim();
  if (!isValid) {
    db.prepare("UPDATE email_verifications SET attempts = attempts + 1 WHERE email = ?").run(normalizedEmail);
    return { ok: false, error: "验证码错误" };
  }

  db.prepare("DELETE FROM email_verifications WHERE email = ?").run(normalizedEmail);
  return { ok: true };
}

export function markEmailVerified(userId: string) {
  db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(userId);
}
