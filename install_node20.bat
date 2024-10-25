@echo off
:: Kiểm tra nếu không chạy với quyền admin, thì tự động khởi chạy lại dưới quyền admin
NET SESSION >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo Dang khoi dong lai voi quyen Administrator...
    powershell -Command "Start-Process '%0' -Verb RunAs"
    exit /b
)

setlocal

:: Kiểm tra nếu Node.js phiên bản 20 đã được cài đặt
node -v | findstr "v20." >nul
if %ERRORLEVEL% equ 0 (
    echo Node.js phien ban 20 da duoc cai dat. Khong can tai lai.
    pause
    exit /b
)

:: Tải Node.js phiên bản 20 nếu chưa có
if not exist "node-v20.18.0-x64.msi" (
    echo Dang tai Node.js phien ban 20...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi' -OutFile 'node-v20.18.0-x64.msi'"
)

:: Cài đặt Node.js 20 vào thư mục chuẩn
echo Dang cai dat Node.js 20...
msiexec /i "node-v20.18.0-x64.msi" /quiet /norestart

:: Xóa file MSI sau khi cài đặt (tuỳ chọn)
del "node-v20.18.0-x64.msi"

:: Cập nhật lại biến môi trường PATH
setx PATH "C:\Program Files\nodejs;%PATH%"

:: Kiểm tra lại cài đặt
echo Kiem tra phien ban Node.js da cai dat:
node -v
if %ERRORLEVEL% equ 0 (
    echo Node.js da duoc cai dat thanh cong!
) else (
    echo Da co loi xay ra trong qua trinh cai dat.
)

pause
endlocal
