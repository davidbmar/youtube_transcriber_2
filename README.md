# YouTube Phrase Scanner

A robust, serverless system for downloading YouTube videos, transcribing them, and scanning for specific phrases.

## Overview

This tool processes YouTube videos from an SQS queue, downloads their audio, transcribes the content using WhisperX, and identifies occurrences of specified phrases. All results are stored in S3 for analysis.

![System Architecture](https://i.imgur.com/placeholder.png)

## Features

- **Queue-Based Processing**: Videos are processed from an SQS queue
- **Robust Download**: Uses multiple download methods (yt-dlp with PyTubeFix fallback)
- **GPU-Accelerated Transcription**: Leverages WhisperX for fast, accurate transcriptions
- **Self-Healing**: Handles spot instance termination and job recovery automatically
- **Progress Tracking**: Tracks job completion at the segment level through S3
- **Continuous Processing**: Polls for new jobs with a fixed interval

## Architecture

### Components

1. **SQS Queue**: Stores YouTube URLs to be processed
2. **Worker Container**: Processes videos and handles transcription
3. **S3 Storage**: Stores job state, transcriptions, and results

### Job Flow

1. Worker pulls message from SQS queue
2. Creates job tracking file in S3 (`jobs/processing/{job_id}.json`)
3. Downloads YouTube audio (tries yt-dlp, falls back to PyTubeFix)
4. Splits audio into segments
5. Transcribes each segment, updating progress
6. Analyzes transcriptions for the target phrase
7. Uploads results to S3 and marks job as completed

### Job States

Jobs move through the following states, tracked in S3:

- `queued`: Waiting to be processed
- `processing`: Currently being worked on
- `completed`: Successfully finished
- `failed`: Failed after multiple attempts

## Failure Handling

### Job Recovery

If a worker is terminated or fails during processing, another worker can recover the job:

1. Incomplete jobs have their processing state in S3
2. Workers can identify and resume abandoned jobs
3. Segment-level tracking allows resuming from where processing stopped

### Error Classification

The system distinguishes between different error types:

- **Transient errors**: Network issues, temporary YouTube restrictions
- **Permanent errors**: Invalid URLs, deleted videos, unsupported formats

## Setup and Usage

### Prerequisites

- Docker
- AWS Account with permissions for:
  - S3 bucket creation and management
  - SQS queue access
  - (Optional) EC2 spot instance management

### Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `phrase` | The phrase to search for | "hustle" |
| `queue_url` | SQS queue URL | (Required) |
| `region` | AWS region | "us-east-1" |
| `s3_bucket` | S3 bucket for storage | "youtube-transcripts" |
| `batch_size` | Videos to process per batch | 5 |

### Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Run the scanner
python scan-sqs-s3.py --queue_url YOUR_SQS_URL --phrase "your phrase"
```

### Docker Deployment

```bash
# Build the Docker image
docker build -t youtube-phrase-scanner .

# Run the container
docker run -d \
  -e AWS_ACCESS_KEY_ID=YOUR_KEY \
  -e AWS_SECRET_ACCESS_KEY=YOUR_SECRET \
  --gpus all \
  youtube-phrase-scanner
```

## Job Tracking System

The S3-based job tracking system is simple yet effective:

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
  │       └── segments/...
  └── results/
      └── {video_id}/...
```

Job status files contain:
- Job metadata (video ID, YouTube URL)
- Processing status and progress
- Error information (if any)
- Worker information

## Testing Components Individually

Each component can be tested independently:

1. **YouTube Downloader**: 
   ```bash
   python -m tests.test_downloader
   ```

2. **Transcription Engine**:
   ```bash
   python -m tests.test_transcription
   ```

3. **Job Tracker**:
   ```bash
   python -m tests.test_job_tracker
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
