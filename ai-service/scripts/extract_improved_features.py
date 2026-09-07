import cv2
import numpy as np
import os
import pandas as pd
from tqdm import tqdm

class ImprovedFeatureExtractor:
    def extract_features_from_video(self, video_path):
        """Extract better features from video."""
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            return None
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Store motion data
        motions = []
        prev_frame = None
        processed = 0
        
        # Store person detection info (if we have YOLO)
        person_counts = []
        
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
                motions.append(motion)
            
            prev_frame = gray
        
        cap.release()
        
        if not motions:
            return None
        
        # Calculate features
        features = {
            'video_name': os.path.basename(video_path),
            'total_frames': frame_count,
            'processed_frames': processed,
            'fps': fps,
            'duration': frame_count / fps if fps > 0 else 0,
            
            # Motion features
            'avg_motion': np.mean(motions),
            'max_motion': np.max(motions),
            'min_motion': np.min(motions),
            'motion_std': np.std(motions),
            'motion_median': np.median(motions),
            'motion_variance': np.var(motions),
            'motion_range': np.max(motions) - np.min(motions),
            
            # Motion pattern features
            'motion_skew': pd.Series(motions).skew(),
            'motion_kurtosis': pd.Series(motions).kurtosis(),
            
            # Activity features
            'activity_score': np.mean(motions) * (processed / frame_count if frame_count > 0 else 0),
            'high_motion_ratio': sum(1 for m in motions if m > 20) / len(motions) if motions else 0,
            'low_motion_ratio': sum(1 for m in motions if m < 5) / len(motions) if motions else 0,
            
            # Movement pattern
            'motion_peaks': self.count_peaks(motions),
            'motion_trend': self.calculate_trend(motions)
        }
        
        return features
    
    def count_peaks(self, motions, threshold=1.5):
        """Count significant motion peaks."""
        if len(motions) < 3:
            return 0
        
        peaks = 0
        for i in range(1, len(motions) - 1):
            if motions[i] > motions[i-1] * threshold and motions[i] > motions[i+1] * threshold:
                peaks += 1
        return peaks
    
    def calculate_trend(self, motions):
        """Calculate if motion is increasing or decreasing."""
        if len(motions) < 2:
            return 0
        
        first_half = np.mean(motions[:len(motions)//2])
        second_half = np.mean(motions[len(motions)//2:])
        
        return 1 if second_half > first_half else -1
    
    def extract_dataset(self, dataset_path, output_path):
        """Extract features from all videos."""
        all_features = []
        
        for root, dirs, files in os.walk(dataset_path):
            for file in tqdm(files, desc="Processing"):
                if file.endswith(('.mp4', '.avi', '.mov')):
                    video_path = os.path.join(root, file)
                    label = os.path.basename(root)
                    
                    features = self.extract_features_from_video(video_path)
                    if features:
                        features['label'] = label
                        all_features.append(features)
        
        df = pd.DataFrame(all_features)
        df.to_csv(output_path, index=False)
        print(f"[OK] Saved {len(df)} features to {output_path}")
        return df

if __name__ == "__main__":
    import pandas as pd
    extractor = ImprovedFeatureExtractor()
    df = extractor.extract_dataset(
        dataset_path="./datasets/shoplifting_videos",
        output_path="./datasets/features/video_features_improved.csv"
    )
