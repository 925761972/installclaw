# 净幕视频号助手

这是一个只在用户电脑本地运行的视频号素材下载辅助工具，目标平台为 Windows 10/11 与 macOS 13+。它不会把微信 Cookie、聊天记录或浏览历史上传到净幕网站。

## 使用方法

1. Windows 双击 `启动净幕视频号助手.cmd`；macOS 打开 `净幕视频号助手.app`。
2. 首次运行按系统提示安装本地证书。
3. 保持助手运行，在 Windows 微信中打开需要处理的视频号视频并播放。
4. 打开 `http://127.0.0.1:2025/console` 查看捕获记录并下载。
5. 双击 `打开下载目录.cmd` 找到 MP4，再上传到净幕网页去字幕。
6. 使用完毕后关闭助手。Windows 可运行 `dist/jingmu-channel-helper.exe uninstall` 卸载证书；macOS 安装包提供对应卸载脚本。

## 平台安装包

- Windows：`净幕视频号助手-Windows-x64.zip`，主程序为 `.exe`。
- macOS Apple Silicon：`净幕视频号助手-macOS-arm64.dmg`。
- macOS Intel：`净幕视频号助手-macOS-x64.dmg`。

三个安装包共享相同控制台和下载流程，但证书与系统代理必须使用各平台原生实现，因此不能用一个可执行文件通吃两个系统。

## 隐私与安全

- 配置已关闭上游云端管理、Hub 同步、雷达监控和 Cloudflare/元宝解析。
- 助手仅监听本机 `127.0.0.1:2025`，通过本机代理识别微信已播放的视频资源。
- 只下载你有权保存和处理的视频；请尊重内容创作者版权及平台规则。

## 开源说明

本工具基于 MIT 许可项目 `nobiyou/wx_channel` 二次配置，原项目地址：
https://github.com/nobiyou/wx_channel

核心代理使用 SunnyNet。上游许可证与原始源码保留在本目录的 `LICENSE`、`pkg/` 和其他源码文件中。
