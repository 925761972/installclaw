import nodemailer from "nodemailer";
import { Resend } from "resend";

let smtpTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getSmtpTransporter() {
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  if (!user || !password) return null;

  if (!smtpTransporter) {
    const port = Number(process.env.SMTP_PORT || "465");
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST?.trim() || "smtpdm.aliyun.com",
      port,
      secure: port === 465,
      auth: { user, pass: password },
    });
  }

  return smtpTransporter;
}

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "re_placeholder") return null;
  return new Resend(apiKey);
}

function getFromAddress() {
  const email =
    process.env.SMTP_FROM_EMAIL?.trim() ||
    process.env.SMTP_USER?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "noreply@zaolang.ltd";
  return `净幕 <${email}>`;
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  const smtp = getSmtpTransporter();
  if (smtp) {
    await smtp.sendMail({ from: getFromAddress(), to, subject, html });
    return;
  }

  const resend = getResend();
  if (resend) {
    const { error } = await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html,
    });
    if (error) throw new Error(`Resend send failed: ${error.message}`);
    return;
  }

  throw new Error("Email service is not configured");
}

export async function sendVerificationCode(email: string, code: string) {
  await sendEmail({
    to: email,
    subject: "净幕 - 邮箱验证码",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif">
        <div style="background:#1a2a1f;padding:32px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#c7f772;margin:0;font-size:24px">净幕</h1>
          <p style="color:#a0b8a8;margin:8px 0 0">AI 字幕擦除</p>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
          <h2 style="margin:0 0 8px;font-size:20px">邮箱验证码</h2>
          <p style="color:#6b7280;margin:0 0 24px">你正在注册净幕账号，请输入以下验证码完成验证：</p>
          <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
            <span style="font-size:32px;font-weight:800;letter-spacing:8px;color:#111827">${code}</span>
          </div>
          <p style="color:#9ca3af;font-size:13px;margin:0">验证码 5 分钟内有效。如非本人操作，请忽略此邮件。</p>
        </div>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  await sendEmail({
    to: email,
    subject: "净幕 - 重置密码",
    html: `
      <div style="max-width:480px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif">
        <div style="background:#1a2a1f;padding:32px;border-radius:12px 12px 0 0;text-align:center">
          <h1 style="color:#c7f772;margin:0;font-size:24px">净幕</h1>
          <p style="color:#a0b8a8;margin:8px 0 0">AI 字幕擦除</p>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-radius:0 0 12px 12px">
          <h2 style="margin:0 0 8px;font-size:20px">重置密码</h2>
          <p style="color:#6b7280;margin:0 0 24px">我们收到了你的密码重置请求。点击下方按钮设置新密码：</p>
          <a href="${resetUrl}" style="display:block;background:#1a2a1f;color:#c7f772;text-align:center;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;margin-bottom:24px">重置密码</a>
          <p style="color:#9ca3af;font-size:13px;margin:0 0 8px">链接 30 分钟内有效。如非本人操作，请忽略此邮件。</p>
          <p style="color:#d1d5db;font-size:12px;margin:0;word-break:break-all">如按钮无法点击，请复制以下链接到浏览器：<br />${resetUrl}</p>
        </div>
      </div>
    `,
  });
}
