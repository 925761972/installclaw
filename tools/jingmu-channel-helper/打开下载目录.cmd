@echo off
cd /d "%~dp0"
if not exist downloads mkdir downloads
explorer "%~dp0downloads"
