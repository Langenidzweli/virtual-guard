import cv2
import numpy as np
import os
import pandas as pd
from tqdm import tqdm

class VideoFeatureExtractor:
    def extract_features_from_video(self, video_path):
        """Extract motion features from a video."""
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            return None
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        features = {
            'video_name': os.path.basename(video_path),
            'fps': fps,
            'total_frames': frame_count,
            'duration': frame_count / fps if fps > 0 else 0,
            'avg_motion': 0,
            'max_motion': 0,
            'motion_std': 0,
            'activity_score': 0
        }
        
        prev_frame = None
        motion_values = []
        processed = 0
        
        for i in range(0, frame_count, 10):
            cap.set(cv2.CAP_PROP_POS_FRAMES, i)
            ret, frame = cap.read()
            
            if not ret:
                break
            
            processed += 1
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            if prev_frame is not None:
                diff = cv2.absdiff(gray, prev_frame)
                motion = np.mean(diff)
                motion_values.append(motion)
            
            prev_frame = gray
        
        cap.release()
        
        if motion_values:
            features['avg_motion'] = np.mean(motion_values)
            features['max_motion'] = np.max(motion_values)
            features['motion_std'] = np.std(motion_values)
            features['activity_score'] = features['avg_motion'] * (processed / frame_count if frame_count > 0 else 0)
        
        return features
    
    def extract_dataset(self, dataset_path, output_path):
        """Extract features from all videos in dataset."""
        all_features = []
        
        for root, dirs, files in os.walk(dataset_path):
            for file in files:
                if file.endswith(('.mp4', '.avi', '.mov')):
                    video_path = os.path.join(root, file)
                    label = os.path.basename(root)
                    
                    print(f" Processing: {file}")
                    features = self.extract_features_from_video(video_path)
                    
                    if features:
                        features['label'] = label
                        all_features.append(features)
        
        df = pd.DataFrame(all_features)
        df.to_csv(output_path, index=False)
        print(f"[OK] Saved {len(df)} features to {output_path}")
        return df

if __name__ == "__main__":
    extractor = VideoFeatureExtractor()
    df = extractor.extract_dataset(
        dataset_path="./datasets/shoplifting_videos",
        output_path="./datasets/features/video_features.csv"
    )
    
    print("\n Feature Summary:")
    print(df.groupby('label').mean())