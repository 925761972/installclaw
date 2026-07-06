@echo off
chcp 65001 >nul
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo 正在申请管理员权限，用于抓取视频号的新视频...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

if not exist "dist\jingmu-channel-helper.exe" (
  echo 未找到净幕视频号助手主程序。
  pause
  exit /b 1
)

echo 正在启动净幕视频号助手...
echo 首次运行会安装本地抓取证书，请按系统提示确认。
echo 下载的视频保存在 downloads 文件夹。
"dist\jingmu-channel-helper.exe" --config "%~dp0config.yaml"
pause
