from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import yt_dlp as youtube_dl
import threading
import os
import re

app = Flask(__name__, static_folder='static')

# Rate limiter: 5 requests per minute per IP
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[
        "3 per minute",
        "10 per hour",
        "20 per day"
    ],
    storage_uri="memory://"
)
limiter.init_app(app)


# Optional shared secret from env
REQUIRE_SECRET = False
APP_SECRET = os.environ.get("APP_SECRET", "loopmania")

YOUTUBE_PATTERN = re.compile(r"^https:\/\/(www\.)?(youtube\.com|youtu\.be)\/")


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/howto')
def howto():
    return render_template('howto.html')

@app.route('/about')
def about():
    return render_template('about.html')


@limiter.limit("5 per minute")
@app.route('/get_audio', methods=['POST'])
def get_audio():
    data = request.get_json()
    youtube_url = data.get('url')
    secret = data.get('secret')

    if not youtube_url:
        return jsonify({'error': 'No URL provided'}), 400

    if REQUIRE_SECRET and secret != APP_SECRET:
        return jsonify({'error': 'Unauthorized'}), 403

    if not YOUTUBE_PATTERN.match(youtube_url):
        return jsonify({'error': 'Invalid YouTube URL'}), 400

    # Remove previous file(s)
    for ext in ['m4a', 'webm', 'mp3', 'opus']:
        try:
            os.remove(f'audio.{ext}')
        except FileNotFoundError:
            pass

    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio',
        'outtmpl': 'audio.%(ext)s',
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'download_sections': ['*00:00:00-00:10:00'],  # Limit to 10 min
        'max_filesize': 30 * 1024 * 1024,  # 30MB max
    }

    try:
        with youtube_dl.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
    except Exception as e:
        return jsonify({'error': 'Failed to download audio'}), 500

    video_title = info.get('title', 'Unknown Title')
    thumbnail_url = info.get('thumbnail', '')
    ext = info.get('ext', 'm4a')
    filename = f'audio.{ext}'

    # Verify file size
    if not os.path.exists(filename):
        return jsonify({'error': 'Audio file not found'}), 500

    size = os.path.getsize(filename)
    if size > 30 * 1024 * 1024:
        os.remove(filename)
        return jsonify({'error': 'Audio too large'}), 400

    return jsonify({
        'title': video_title,
        'thumbnail': thumbnail_url,
        'audio_file': filename
    })


@app.route('/audio/<filename>')
def download_file(filename):
    # Auto-delete file 60 seconds after access
    path = os.path.join('.', filename)

    if not os.path.exists(path):
        return "File not found", 404

    threading.Timer(60.0, lambda: os.path.exists(path) and os.remove(path)).start()
    return send_from_directory(directory='.', path=filename)


if __name__ == '__main__':
    app.run(debug=True)
