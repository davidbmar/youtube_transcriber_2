#!/usr/bin/env python3
# send_to_queue.py - Send YouTube URLs to SQS queue for processing

import argparse
import boto3
import json
import sys
import re

def parse_arguments():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(
        description="Send YouTube URLs to SQS queue for processing by the YouTube Phrase Scanner."
    )
    parser.add_argument(
        "--youtube_url", "-y",
        type=str,
        required=True,
        help="YouTube URL to process (e.g., https://www.youtube.com/watch?v=a1Ih5GGtR8Q)"
    )
    parser.add_argument(
        "--queue_url", "-q",
        type=str,
        default="https://sqs.us-east-2.amazonaws.com/635071011057/2025-03-15-youtube-transcription-queue",
        help="URL of the SQS queue"
    )
    parser.add_argument(
        "--region", "-r",
        type=str,
        default="us-east-2",
        help="AWS region for SQS (Default: 'us-east-2')"
    )
    parser.add_argument(
        "--phrase", "-p",
        type=str,
        help="Optional custom phrase to search for in the video"
    )
    return parser.parse_args()

def validate_youtube_url(url):
    """Validate that the URL is a valid YouTube URL"""
    youtube_pattern = r'^(https?://)?(www\.)?(youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11}).*$'
    match = re.match(youtube_pattern, url)
    if not match:
        return False
    return True

def main():
    """Main entry point"""
    args = parse_arguments()
    
    # Validate YouTube URL
    if not validate_youtube_url(args.youtube_url):
        print(f"Error: '{args.youtube_url}' is not a valid YouTube URL")
        sys.exit(1)
    
    try:
        # Initialize SQS client
        sqs = boto3.client('sqs', region_name=args.region)
        
        # Create message body
        message = {'youtube_url': args.youtube_url}
        
        # Add custom phrase if provided
        if args.phrase:
            message['phrase'] = args.phrase
            
        message_body = json.dumps(message)
        
        # Send message to SQS queue
        response = sqs.send_message(
            QueueUrl=args.queue_url,
            MessageBody=message_body
        )
        
        print(f"Message sent successfully!")
        print(f"YouTube URL: {args.youtube_url}")
        if args.phrase:
            print(f"Custom phrase: {args.phrase}")
        print(f"Message ID: {response['MessageId']}")
        print(f"Queue URL: {args.queue_url}")
        
    except Exception as e:
        print(f"Error sending message: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
