@echo off
setlocal
cd /d "%~dp0"

echo.
echo === Loopretto ===
echo.

REM --- Check Python ---
where python >nul 2>nul
if errorlevel 1 (
    echo Python is not installed on this computer.
    echo.
    echo A browser tab will open to download Python.
    echo IMPORTANT: on the Python installer, tick the box
    echo            "Add python.exe to PATH" before clicking Install.
    echo.
    echo After installing Python, run this file again.
    echo.
    start "" https://www.python.org/downloads/
    pause
    exit /b 1
)

REM --- First-time setup ---
if not exist ".venv\Scripts\python.exe" (
    echo First time setup - this can take a couple of minutes...
    echo.
    python -m venv .venv
    if errorlevel 1 (
        echo Failed to create the virtual environment.
        pause
        exit /b 1
    )
    .venv\Scripts\python.exe -m pip install --quiet --upgrade pip
    .venv\Scripts\python.exe -m pip install --quiet -r requirements.txt
    if errorlevel 1 (
        echo Failed to install dependencies.
        pause
        exit /b 1
    )
    echo.
    echo Setup complete.
    echo.
)

REM --- Launch ---
echo Loopretto is starting at http://localhost:5000
echo Keep this window open while you use the app.
echo Close this window to stop the app.
echo.

REM The browser tab is opened by app.py once the server is ready.
.venv\Scripts\python.exe app.py

pause