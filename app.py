from flask import Flask, render_template, jsonify
import requests

app = Flask(__name__, static_folder='static')

@app.route("/piped/<video_id>")
def piped_proxy(video_id):
    piped_instances = [
        "https://pipedapi.kavin.rocks",
        "https://pipedapi.leptons.xyz",
        "https://pipedapi.adminforge.de",
    ]

    for base_url in piped_instances:
        try:
            url = f"{base_url}/streams/{video_id}"
            print(f"🔎 Trying {url}")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()

            if data.get("audioStreams"):
                print(f"✅ Success from {base_url}")
                return jsonify(data)
            else:
                print(f"⚠️ No audio streams from {base_url}: {data}")
        except Exception as e:
            print(f"❌ Error from {base_url}: {e}")

    print("💥 All piped instances failed.")
    return jsonify({"error": "No audio streams available"}), 500

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/howto')
def howto():
    return render_template('howto.html')

@app.route('/about')
def about():
    return render_template('about.html')

if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
