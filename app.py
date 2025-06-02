from flask import Flask, render_template, request, jsonify, send_from_directory
import yt_dlp as youtube_dl
import os

app = Flask(__name__, static_folder='static')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/howto')
def howto():
    return render_template('howto.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/get_audio', methods=['POST'])
def get_audio():
    data = request.get_json()
    youtube_url = data.get('url')

    if not youtube_url:
        return jsonify({'error': 'No URL provided'}), 400

    # Remove previous file if it exists
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
    }

    with youtube_dl.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(youtube_url, download=True)

    video_title = info.get('title', 'Unknown Title')
    thumbnail_url = info.get('thumbnail', '')
    ext = info.get('ext', 'm4a')  # fallback just in case
    filename = f'audio.{ext}'

    return jsonify({
        'title': video_title,
        'thumbnail': thumbnail_url,
        'audio_file': filename
    })


@app.route('/audio/<filename>')
def download_file(filename):
    return send_from_directory(directory='.', path=filename)

if __name__ == '__main__':
    app.run(debug=True)
