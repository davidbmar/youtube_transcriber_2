# Task: YouTube Phrase Scanner Implementation

I need your help implementing a robust YouTube phrase scanning system with the following requirements:

## Overview
The system downloads YouTube videos from an SQS queue, transcribes them, and searches for specific phrases in the content. The system should be extremely robust to handle spot instance termination and have the ability to recover from failures at any stage of processing.

## Key Components

1. **Job Tracking System**: 
   - Uses S3 as a simple state tracking mechanism (no DynamoDB needed)
   - Jobs move through states: queued → processing → completed/failed
   - Tracks progress at the segment level to support resuming interrupted jobs
   - Clear error separation for permanent vs. temporary failures

2. **Video Processing Pipeline**:
   - YouTube download with fallback mechanisms (yt-dlp → PyTubeFix)
   - Audio conversion using ffmpeg
   - Segmentation of audio into manageable chunks
   - Transcription using WhisperX
   - Phrase scanning across all segments

3. **Self-healing Worker**:
   - Each worker both processes new jobs and recovers abandoned ones
   - Simple, fixed polling interval (60 seconds)
   - Clear lockout mechanism to prevent duplicate processing
   - Controlled retry mechanism (max 3 attempts per job)

## Technical Constraints
- All state tracking using S3 (not a database)
- Processing on potentially unstable spot instances
- Multiple workers may be running simultaneously
- Workers need to handle their own termination gracefully

## Structure
The code should be organized in modular, testable components:
1. `job_tracker.py` - For S3-based job tracking
2. `downloader.py` - For YouTube downloading with fallback
3. `transcriber.py` - For speech-to-text processing
4. `scanner.py` - For phrase scanning
5. `worker.py` - Main worker that ties everything together

## Implementation Notes
- Prioritize simplicity and understandability
- Favor explicit state tracking over complex recovery mechanisms
- Design for testability (components can be tested independently)
- Use meaningful logging throughout the system
- Focus on making the system self-healing without external orchestration

Could you help me implement this system following these requirements? Please start by creating the `job_tracker.py` module as the foundation, focusing on the S3-based job tracking system that handles job states, progress tracking, and abandoned job recovery.
