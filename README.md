# YouTube Phrase Scanner

A robust, serverless system for downloading YouTube videos, transcribing them, and scanning for specific phrases.

## Overview

This tool processes YouTube videos from an SQS queue, downloads their audio, transcribes the content using WhisperX, and identifies occurrences of specified phrases. All results are stored in S3 for analysis.

## Features

- **Queue-Based Processing**: Videos are processed from an SQS queue
- **Robust Download**: Uses multiple download methods (yt-dlp with PyTubeFix fallback)
- **GPU-Accelerated Transcription**: Leverages WhisperX for fast, accurate transcriptions
- **Self-Healing**: Handles spot instance termination and job recovery automatically
- **Progress Tracking**: Tracks job completion at the segment level through S3
- **Continuous Processing**: Polls for new jobs with a fixed interval
- **Resumable Transcription**: Can continue transcription from where it left off if interrupted

## Architecture

### Components

1. **Worker (`worker.py`)**: Main component that coordinates the processing pipeline
2. **Job Tracker (`job_tracker.py`)**: Manages job states and progress in S3
3. **Downloader (`downloader.py`)**: Handles YouTube video downloading with fallback mechanisms
4. **Transcriber (`transcriber.py`)**: Performs audio transcription using WhisperX
5. **Scanner (`scanner.py`)**: Scans transcripts for phrases and generates statistics
6. **Queue Utility (`send_to_queue.py`)**: Helper script to send YouTube URLs to the queue

### Job Flow

1. Worker pulls message from SQS queue
2. Creates job tracking file in S3 (`jobs/processing/{job_id}.json`)
3. Downloads YouTube audio (tries yt-dlp, falls back to PyTubeFix)
4. Converts audio to WAV format using ffmpeg
5. Splits audio into segments for processing
6. Transcribes each segment using WhisperX, updating progress
7. Scans transcriptions for the target phrase
8. Uploads results to S3 and marks job as completed
9. Updates the master video list in S3

### Job States

Jobs move through the following states, tracked in S3:

- `queued`: Waiting to be processed
- `processing`: Currently being worked on
- `completed`: Successfully finished
- `failed`: Failed after multiple attempts

## S3 Storage Structure

```
s3://your-bucket/
  ├── jobs/
  │   ├── queued/
  │   │   └── {job_id}.json
  │   ├── processing/
  │   │   └── {job_id}.json
  │   ├── completed/
  │   │   └── {job_id}.json
  │   └── failed/
  │       └── {job_id}.json
  ├── transcripts/
  │   └── {video_id}/
  │       ├── full_transcript.json
  │       └── segments/
  │           └── chunk_{XXXX}.json
  ├── results/
  │   └── {video_id}/
  │       └── {timestamp}-results.json
  ├── workers/
  │   └── {worker_id}.json
  └── youtube_transcriber_2.json  (master video list)
```

## Failure Handling

### Job Recovery

If a worker is terminated or fails during processing, another worker can recover the job:

1. Incomplete jobs have their processing state in S3
2. Workers scan for abandoned jobs (where lock has expired)
3. Segment-level tracking allows resuming transcription from where it stopped
4. Maximum of 3 retry attempts before marking a job as permanently failed

### Error Classification

The system distinguishes between different error types:

- **DownloadError**: General errors during video download
- **TokenError**: YouTube token errors that might be temporary
- **NetworkError**: Connection issues that can be retried
- **TranscriptionError**: Errors during audio transcription
- **ModelLoadError**: Failures to load the WhisperX model
- **AudioProcessingError**: Problems with audio file processing

## Setup and Usage

### Prerequisites

- Python 3.7+
- FFmpeg
- AWS Account with permissions for:
  - S3 bucket creation and management
  - SQS queue access
  - (Optional) GPU for faster transcription

### Installation

```bash
# Clone this repository
git clone https://github.com/yourusername/youtube-phrase-scanner.git
cd youtube-phrase-scanner

# Install dependencies
pip install -r requirements.txt
```

### Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `phrase` | The phrase to search for | "hustle" |
| `temp_dir` | Directory for temporary files | "./temp" |
| `queue_url` | SQS queue URL | (Required) |
| `region` | AWS region | "us-east-1" |
| `s3_bucket` | S3 bucket for storage | "youtube-transcripts" |
| `batch_size` | Videos to process per batch | 5 |
| `poll_interval` | Seconds between queue polls | 60 |
| `cpu` | Use CPU instead of GPU | False |

### Running the Worker

```bash
# Run the scanner with default settings
python worker.py --queue_url YOUR_SQS_QUEUE_URL

# Run with custom settings
python worker.py \
  --queue_url YOUR_SQS_QUEUE_URL \
  --s3_bucket YOUR_S3_BUCKET \
  --region YOUR_AWS_REGION \
  --phrase "your target phrase" \
  --batch_size 10 \
  --poll_interval 30
  
# Run using CPU instead of GPU
python worker.py --queue_url YOUR_SQS_QUEUE_URL --cpu
```

### Sending Videos to the Queue

```bash
# Add a video to the processing queue
python send_to_queue.py --youtube_url "https://www.youtube.com/watch?v=YOUR_VIDEO_ID"

# Add with a custom phrase to search for
python send_to_queue.py \
  --youtube_url "https://www.youtube.com/watch?v=YOUR_VIDEO_ID" \
  --phrase "custom phrase"
```

## Technical Details

### WhisperX Configuration

The system uses WhisperX for transcription with the following settings:
- Default model: `large-v2`
- Segment size: 30 seconds
- Voice activity detection thresholds: onset=0.3, offset=0.3
- Word-level timestamps through alignment model

### Result Format

The scanner produces JSON results with:
- Timestamp information
- Total occurrences of the target phrase
- Word and character counts
- List of segments containing the phrase
- Distribution of phrase occurrences over time

### Docker Support

The system includes Docker health checks and supports containerized deployment, making it suitable for:
- AWS ECS
- Kubernetes
- Standalone Docker containers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
