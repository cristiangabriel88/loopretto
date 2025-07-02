# Use a stable Python version
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies (if needed)
RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

# Copy your code
COPY . .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the default Flask port
EXPOSE 5000

# Start the Flask app
CMD ["python", "app.py"]
