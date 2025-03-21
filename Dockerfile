FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04

# Set noninteractive installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && \
    apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    git \
    wget \
    curl \
    nodejs \
    npm \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Create app directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt /app/

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Install WhisperX
RUN pip3 install git+https://github.com/m-bain/whisperx.git

# Copy application code
COPY *.py /app/

# Create necessary directories
RUN mkdir -p /app/temp

# Environment variables
ENV AWS_DEFAULT_REGION=us-east-1

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=60s --retries=3 \
  CMD python3 -c "import os, time; health_file='/app/health_check.txt'; exit(0 if os.path.exists(health_file) and time.time() - os.path.getmtime(health_file) < 300 else 1)"

# Set entrypoint
ENTRYPOINT ["python3", "worker.py"]

# Default arguments (can be overridden)
CMD ["--help"]
