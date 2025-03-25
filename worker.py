def update_video_list(self, video_id):
    """Update the youtube_transcriber_2.json file with the new video ID and metadata"""
    video_list_key = "youtube_transcriber_2.json"
    
    try:
        # Try to get the existing video list
        try:
            response = self.s3.get_object(Bucket=self.s3_bucket, Key=video_list_key)
            video_list = json.loads(response['Body'].read().decode('utf-8'))
            logger.info(f"Retrieved existing video list with {len(video_list['videos'])} videos")
        except self.s3.exceptions.NoSuchKey:
            # If the file doesn't exist yet, create an empty structure
            logger.info("No existing video list found, creating new one")
            video_list = {"videos": []}
        
        # Get video title from YouTube
        video_title = self.get_video_title(video_id)
        
        # Check if video ID is already in the list
        existing_video = next((item for item in video_list["videos"] if item["id"] == video_id), None)
        
        if not existing_video:
            # Add the new video with metadata
            new_video = {
                "id": video_id,
                "title": video_title,
                "processed_at": datetime.now().isoformat(),
                "thumbnail": f"https://img.youtube.com/vi/{video_id}/mqdefault.jpg"
            }
            
            video_list["videos"].append(new_video)
            
            # Sort the list by processed date (newest first)
            video_list["videos"].sort(key=lambda x: x.get("processed_at", ""), reverse=True)
            
            # Convert to JSON and upload back to S3
            video_list_json = json.dumps(video_list, indent=2)
            self.s3.put_object(
                Body=video_list_json,
                Bucket=self.s3_bucket,
                Key=video_list_key,
                ContentType="application/json"
            )
            logger.info(f"Added video {video_id} to youtube_transcriber_2.json (total: {len(video_list['videos'])})")
        else:
            logger.info(f"Video {video_id} already in youtube_transcriber_2.json")
            
        return True
    except Exception as e:
        logger.error(f"Error updating video list: {str(e)}")
        return False

def get_video_title(self, video_id):
    """Get the title of a YouTube video using yt-dlp"""
    try:
        import subprocess
        
        # Try to get video title using yt-dlp
        cmd = ["yt-dlp", "--get-title", f"https://www.youtube.com/watch?v={video_id}"]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
        
        # Fallback to a generic title if yt-dlp fails
        return f"YouTube Video {video_id}"
    except Exception as e:
        logger.error(f"Error getting video title: {str(e)}")
        return f"YouTube Video {video_id}"
