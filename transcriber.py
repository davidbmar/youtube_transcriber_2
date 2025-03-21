#!/usr/bin/python3
import os
import subprocess
import logging
import json
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

class TranscriptionError(Exception):
    """Exception raised for errors during transcription"""
    pass

class AudioSegmenter:
    """Splits audio files into manageable segments"""
    
    def __init__(self, segment_duration=60):
        """Initialize the segmenter"""
        self.segment_duration = segment_duration
    
    def get_audio_duration(self, wav_file):
        """Get duration of WAV file in seconds"""
        cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", wav_file
        ]
        
        try:
            result = subprocess.run(
                cmd, 
                capture_output=True, 
                text=True, 
                check=True
            )
            
            duration = float(result.stdout.strip())
            return duration
            
        except subprocess.SubprocessError as e:
            logger.error(f"Error getting audio duration: {str(e)}")
            raise
    
    def split_audio(self, wav_file, output_dir):
        """
        Split WAV file into segments
        
        Args:
            wav_file: Path to WAV file
            output_dir: Directory to save segments
            
        Returns:
            List of paths to segment files
        """
        os.makedirs(output_dir, exist_ok=True)
        
        try:
            total_duration = self.get_audio_duration(wav_file)
            segments = []
            idx = 0
            start_time = 0
            
            while start_time < total_duration:
                output_file = os.path.join(output_dir, f"segment_{idx:03d}.wav")
                
                # Run ffmpeg with minimal output
                result = subprocess.run([
                    "ffmpeg", "-y",
                    "-ss", str(start_time),
                    "-t", str(self.segment_duration),
                    "-i", wav_file,
                    output_file
                ], capture_output=True, text=True, check=False)
                
                if result.returncode != 0:
                    logger.error(f"Error splitting segment {idx}: {result.stderr}")
                    raise Exception(f"ffmpeg error: {result.stderr}")
                
                segments.append(output_file)
                
                # Log less frequently
                if idx % 5 == 0:
                    logger.info(f"Created segment {idx} from {start_time:.0f} to {start_time + self.segment_duration:.0f} sec")
                    
                idx += 1
                start_time += self.segment_duration
                
            logger.info(f"Created {len(segments)} segments total")
            return segments
            
        except Exception as e:
            logger.error(f"Error splitting audio: {str(e)}")
            raise


class WhisperTranscriber:
    """Transcribes audio segments using WhisperX"""
    
    def __init__(self, use_gpu=True):
        """Initialize the transcriber"""
        self.use_gpu = use_gpu
        self.model = None
        self.device = "cuda" if use_gpu else "cpu"
    
    def load_model(self):
        """Load WhisperX model"""
        if self.model is not None:
            return
            
        try:
            # Reduce TensorFlow logging
            os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
            
            import whisperx
            compute_type = "float16" if self.use_gpu else "float32"
            
            logger.info("Loading WhisperX model (this may take a moment)...")
            self.model = whisperx.load_model(
                "large", device=self.device, compute_type=compute_type
            )
            logger.info("WhisperX model loaded successfully")
            
        except ImportError:
            error_msg = "WhisperX is not installed. Install via 'pip install whisperx'"
            logger.error(error_msg)
            raise TranscriptionError(error_msg)
            
        except Exception as e:
            error_msg = f"Error loading WhisperX model: {str(e)}"
            logger.error(error_msg)
            raise TranscriptionError(error_msg)
    
    def transcribe_segment(self, segment_file):
        """
        Transcribe a single audio segment
        
        Args:
            segment_file: Path to segment WAV file
            
        Returns:
            Transcribed text
        """
        # Load model if not already loaded
        if self.model is None:
            self.load_model()
            
        import whisperx
        
        segment_name = os.path.basename(segment_file)
        segment_num = int(segment_name.split('_')[1].split('.')[0])
        
        # Log less frequently for cleaner output
        if segment_num % 5 == 0:
            logger.info(f"Transcribing segment {segment_num}...")
        
        # Redirect stdout/stderr during WhisperX operations
        old_stdout, old_stderr = os.dup(1), os.dup(2)
        
        try:
            # Silence standard output during transcription
            with open(os.devnull, 'w') as devnull:
                os.dup2(devnull.fileno(), 1)
                os.dup2(devnull.fileno(), 2)
                
                # Perform transcription
                result = self.model.transcribe(segment_file)
                language = result.get("language", "en")
                
                # Align the result
                align_model, metadata = whisperx.load_align_model(language, self.device)
                result_aligned = whisperx.align(result["segments"], align_model, metadata, segment_file, self.device)
                
                # Extract text from segments
                transcription = ""
                for segment in result_aligned["segments"]:
                    transcription += segment["text"].strip() + " "
                    
                return transcription.strip()
                
        except Exception as e:
            logger.error(f"Error transcribing segment {segment_file}: {str(e)}")
            raise TranscriptionError(f"Transcription error: {str(e)}")
            
        finally:
            # Restore stdout/stderr
            os.dup2(old_stdout, 1)
            os.dup2(old_stderr, 2)
            os.close(old_stdout)
            os.close(old_stderr)
    
    def transcribe_segments(self, segment_files, output_dir=None):
        """
        Transcribe multiple segments
        
        Args:
            segment_files: List of segment WAV files
            output_dir: Directory to save transcript files (defaults to same as segments)
            
        Returns:
            List of (segment_file, transcript_file) tuples
        """
        results = []
        
        for segment_file in segment_files:
            try:
                # Determine output directory
                if output_dir is None:
                    output_dir = os.path.dirname(segment_file)
                    
                # Create transcript filename
                transcript_file = segment_file.replace(".wav", ".txt")
                
                # Transcribe the segment
                transcription = self.transcribe_segment(segment_file)
                
                # Save to file
                with open(transcript_file, "w", encoding="utf-8") as f:
                    f.write(transcription)
                    
                results.append((segment_file, transcript_file))
                
            except Exception as e:
                logger.error(f"Error processing segment {segment_file}: {str(e)}")
                # Continue with other segments
        
        return results
    
    def cleanup(self):
        """Release resources"""
        import gc
        import torch
        
        # Clear model references
        self.model = None
        
        # Run garbage collection
        gc.collect()
        
        # Clear CUDA cache if available
        if self.use_gpu and torch.cuda.is_available():
            torch.cuda.empty_cache()
            logger.info("Cleared CUDA cache")


# Example usage
if __name__ == "__main__":
    # Simple test code
    logging.basicConfig(level=logging.INFO)
    
    try:
        # Initialize segmenter
        segmenter = AudioSegmenter(segment_duration=30)  # 30-second segments for testing
        
        # Split a sample WAV file
        sample_wav = "./sample.wav"  # Replace with your test file
        segments = segmenter.split_audio(sample_wav, "./temp/segments")
        
        # Initialize transcriber
        transcriber = WhisperTranscriber(use_gpu=False)  # CPU mode for testing
        
        # Transcribe the first segment
        if segments:
            test_segment = segments[0]
            print(f"Transcribing test segment: {test_segment}")
            
            text = transcriber.transcribe_segment(test_segment)
            print(f"Transcription: {text}")
            
            # Clean up
            transcriber.cleanup()
            
    except Exception as e:
        print(f"Error: {str(e)}")
