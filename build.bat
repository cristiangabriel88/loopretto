@echo off
setlocal
cd /d "%~dp0"

echo.
echo === Building Loopretto for Windows ===
echo.

REM --- Reuse (or create) the project venv ---
if not exist ".venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv .venv
    if errorlevel 1 (
        echo Failed to create the virtual environment. Is Python installed and on PATH?
        pause
        exit /b 1
    )
)

set "PY=.venv\Scripts\python.exe"

echo Installing app + build dependencies...
"%PY%" -m pip install --quiet --upgrade pip
"%PY%" -m pip install --quiet -r requirements.txt
"%PY%" -m pip install --quiet pyinstaller pillow
if errorlevel 1 (
    echo Failed to install dependencies.
    pause
    exit /b 1
)

echo Generating app icon...
"%PY%" scripts\make_icons.py
if errorlevel 1 (
    echo Failed to generate the icon.
    pause
    exit /b 1
)

echo Cleaning previous build output...
if exist "dist\Loopretto" rmdir /s /q "dist\Loopretto"

echo Building the executable (this can take a few minutes)...
"%PY%" -m PyInstaller loopretto.spec --noconfirm
if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
)

echo Packaging the release zip...
set "ZIP=dist\Loopretto-windows.zip"
if exist "%ZIP%" del /q "%ZIP%"
powershell -NoProfile -Command "Compress-Archive -Path 'dist\Loopretto\*' -DestinationPath '%ZIP%' -Force"
if errorlevel 1 (
    echo Failed to create the zip.
    pause
    exit /b 1
)

echo.
echo === Done ===
echo Folder:  dist\Loopretto\Loopretto.exe
echo Zip:     %ZIP%
echo.
echo Upload %ZIP% to the GitHub Releases page.
echo.
pause
