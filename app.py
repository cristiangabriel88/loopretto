from flask import Flask, render_template, request, jsonify, send_from_directory
import yt_dlp as youtube_dl
import os

app = Flask(__name__, static_folder='static')


# Serve the HTML file
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/howto')
def howto():
    return render_template('howto.html')

@app.route('/about')
def about():
    return render_template('about.html')

# Hook function to report download progress
def progress_hook(d):
    if d['status'] == 'downloading':
        downloaded_bytes = d.get('downloaded_bytes', 0)
        total_bytes = d.get('total_bytes', 1)  # Prevent division by zero
        progress = int(downloaded_bytes / total_bytes * 100)
        socketio.emit('download_progress', {'progress': progress})

@app.route('/get_audio', methods=['POST'])
def get_audio():
    data = request.get_json()
    youtube_url = data.get('url')

    if not youtube_url:
        return jsonify({'error': 'No URL provided'}), 400

    if os.path.exists('audio.mp3'):
        os.remove('audio.mp3')

    # Extract audio and metadata using youtube_dl with a progress hook
    ydl_opts = {
    'format': 'bestaudio/best',
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
    }],
    'outtmpl': 'audio.%(ext)s',
    'noplaylist': True,
    'writethumbnail': False,  # Do not download thumbnails
    'writeinfojson': False,   # Do not write metadata as JSON
    'writesubtitles': False,  # Do not download subtitles
    'nocheckcertificate': True,  # Skip certificate checks for faster downloads
    'quiet': True,  # Suppress non-error messages
    'no_warnings': True,  # Suppress warnings
    }

    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=True)
    
    video_title = info.get('title', 'Unknown Title')
    thumbnail_url = info.get('thumbnail', '')

    return jsonify({
        'title': video_title,
        'thumbnail': thumbnail_url,
        'audio_file': 'audio.mp3'
    })

@app.route('/audio/<filename>')
def download_file(filename):
    return send_from_directory(directory='.', path=filename)

if __name__ == '__main__':
    app.run(debug=True)
