# 净幕｜AI 字幕擦除 SaaS

一个可直接运行的全栈 MVP：用户注册、积分充值、视频直传/URL 输入、标准版与精细化版字幕擦除、异步任务轮询、实际时长结算、失败退款与结果下载。

## 本地启动

```bash
npm install
copy .env.example .env.local
npm run dev
```

打开 `http://localhost:3000`。在 `.env.local` 中填写 `VOLCENGINE_MEDIAKIT_API_KEY` 后才会真实提交擦除任务。

## 已实现

- scrypt 加盐密码、HttpOnly 会话 Cookie、SQLite 持久化
- API Key 仅保留在服务端，不下发浏览器
- 火山引擎本地媒体预签名直传，文件不经过本站服务器中转
- 标准版 `erase-video-subtitle` 与精细化版 `erase-video-subtitle-pro`
- 精细化版字幕/全文本、画质/体积优先，以及视频画布拖拽框选
- 支持 1～20 个独立擦除选区，自动换算为 0～1 比例坐标，可逐个删除或清空重画
- 任务幂等 token、状态轮询、24 小时结果链接提示
- 按真实时长冻结积分、余额不足前置拦截、失败自动退款
- 四档积分套餐和幂等充值账本
- 套餐页已接入支付宝支付下单，并预留支付宝扫码与微信支付扩展位

## 上线前必须完成

1. 补齐微信支付或聚合支付接入，并完成支付宝生产参数、回调域名与线上验签联调。
2. 使用云数据库替代单机 SQLite（推荐 PostgreSQL），并把任务结算放入队列/定时任务，避免依赖用户打开页面轮询。
3. 增加服务端视频时长探测、上传大小限制、频率限制、邮箱验证、找回密码、管理后台与风控。
4. 将结果文件及时转存到自有对象存储；火山引擎返回的结果地址默认只有 24 小时有效。
5. 配置用户协议、隐私政策、退款规则、发票和必要的 ICP/公安备案信息。

## 配置

参见 [.env.example](./.env.example)。定价与毛利测算见 [PRICING.md](./PRICING.md)。

## 支付说明

- 首发前端仅展示支付宝支付入口
- `PAYMENT_METHOD=alipay_web` 时走支付宝电脑网站支付，套餐页收到 `html_form` 后会直接提交表单跳转收银台
- `PAYMENT_METHOD=alipay_qr` 时走支付宝扫码支付，套餐页会展示二维码弹窗
- 用户积分只会在 `/api/payments/alipay/notify` 异步回调验签成功后到账
- 前端跳转成功页不代表已经入账，到账以服务端回调处理结果为准

## 官方接口依据

- [字幕擦除开发指南](https://www.volcengine.com/docs/6448/2371372?lang=zh)
- [标准版提交 API](https://www.volcengine.com/docs/6448/2386125?lang=zh)
- [精细化版提交 API](https://www.volcengine.com/docs/6448/2372084?lang=zh)
- [任务查询 API](https://www.volcengine.com/docs/6448/2278532?lang=zh)
- [媒体上传地址 API](https://www.volcengine.com/docs/6448/2536891?lang=zh)
- [视频工具计费](https://www.volcengine.com/docs/6448/2486473?lang=zh)
