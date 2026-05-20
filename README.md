# Loopretto

A small app that downloads a YouTube song and lets you loop sections of it in your browser - great for practicing music, transcribing, or studying songs.

It runs locally on your computer. No account, no upload, no cloud.

---

## Easiest way to run it (Windows)

### Step 1 - Install Python (one time, only if you do not have it)

1. Go to https://www.python.org/downloads/
2. Click the big yellow **Download Python** button.
3. Open the installer.
4. **VERY IMPORTANT:** tick the box that says **"Add python.exe to PATH"** at the bottom of the first installer window.
5. Click **Install Now** and wait for it to finish.

### Step 2 - Download Loopretto

1. On this GitHub page, click the green **Code** button (top right of the file list).
2. Click **Download ZIP**.
3. Right-click the downloaded zip file and choose **Extract All...**
4. Pick a folder you can find again (for example your Desktop).

### Step 3 - Run it

1. Open the extracted `loopretto` folder.
2. Double-click **`run.bat`**.
3. The first time, it will set itself up - this takes a couple of minutes. Just wait.
4. When it is ready, your browser opens automatically at `http://localhost:5000`.
5. Paste a YouTube link and start looping.

To stop the app, close the black window that opened.

To use it again later, just double-click `run.bat` again - the setup is skipped, it starts in a couple of seconds.

---

## How to use the app

1. Paste a YouTube URL into the input box and press **Load**.
2. Wait for the song to load (audio is capped at 10 minutes).
3. Drag on the waveform to select a section.
4. Press play - it loops that section until you stop it.

---

## If a song won't load

Songs should load with no setup. If a *specific* video refuses (YouTube occasionally throws a "confirm you're not a bot" check, or the video is age-restricted/private), you have two optional fallbacks - add one line near the top of `run.bat` (after `setlocal`):

- **Use your browser's YouTube login** (best for age-restricted videos):
  ```
  set COOKIES_FROM_BROWSER=firefox
  ```
  Firefox works while open; if you pick `chrome` or `edge`, fully close that browser first (Windows locks their cookies).
- **Or point at a cookies file** exported with a browser extension ("Get cookies.txt LOCALLY"):
  ```
  set COOKIES_FILE=C:\path\to\cookies.txt
  ```

Either way, your cookies never leave your computer.

---

## Running on Mac or Linux

There is no `run.bat` for Mac/Linux, but it is just three commands. Open a terminal in the project folder:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Then open http://localhost:5000 in your browser.

---

## FAQ

**Is anything sent to a server I do not own?**
The audio is fetched from YouTube directly to your computer. The web page itself is served from your own machine.

**Where is the song file saved?**
In the project folder as `audio.m4a` (or similar). It stays there until you load another song, which replaces it. Nothing is uploaded anywhere.

**Can I host this online so other people can use it?**
No - and it is not meant to be. Run from a server, YouTube blocks the download with a "confirm you're not a bot" check, so it only works on a personal computer. That is the whole idea: Loopretto is a local tool, just for you.

**It says "Python is not installed" but I just installed it.**
Close the black window, then double-click `run.bat` again. If it still does not work, re-run the Python installer and make sure the **"Add python.exe to PATH"** box was ticked.

**Can I change the port?**
Yes. Set the `PORT` environment variable before launching. On Windows you can edit `run.bat` and add `set PORT=8080` near the top.