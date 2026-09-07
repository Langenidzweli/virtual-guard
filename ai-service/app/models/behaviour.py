import joblib
import numpy as np
import pandas as pd
import cv2
import os
import logging
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BehaviourFeatureDefinition:
    name: str
    dtype: str
    description: str


BEHAVIOUR_FEATURE_SCHEMA = [
    BehaviourFeatureDefinition('avg_motion', 'float', 'Average absolute frame-to-frame intensity change.'),
    BehaviourFeatureDefinition('max_motion', 'float', 'Maximum absolute frame-to-frame intensity change.'),
    BehaviourFeatureDefinition('min_motion', 'float', 'Minimum absolute frame-to-frame intensity change.'),
    BehaviourFeatureDefinition('motion_std', 'float', 'Standard deviation of frame-to-frame motion intensity.'),
    BehaviourFeatureDefinition('motion_median', 'float', 'Median motion intensity across sampled frames.'),
    BehaviourFeatureDefinition('motion_variance', 'float', 'Variance of motion intensity across sampled frames.'),
    BehaviourFeatureDefinition('motion_range', 'float', 'Difference between the highest and lowest motion values.'),
    BehaviourFeatureDefinition('motion_skew', 'float', 'Skewness of the motion distribution.'),
    BehaviourFeatureDefinition('motion_kurtosis', 'float', 'Kurtosis of the motion distribution.'),
    BehaviourFeatureDefinition('activity_score', 'float', 'Motion intensity weighted by the proportion of processed frames.'),
    BehaviourFeatureDefinition('high_motion_ratio', 'float', 'Fraction of sampled frames with motion above the high-motion threshold.'),
    BehaviourFeatureDefinition('low_motion_ratio', 'float', 'Fraction of sampled frames with motion below the low-motion threshold.'),
    BehaviourFeatureDefinition('motion_peaks', 'float', 'Count of significant local peaks in motion intensity.'),
    BehaviourFeatureDefinition('motion_trend', 'float', 'Direction of motion trend over the sampled sequence.'),
]

BEHAVIOUR_FEATURE_COLUMNS = [feature.name for feature in BEHAVIOUR_FEATURE_SCHEMA]
BEHAVIOUR_TARGET_MAPPING = {'normal': 0, 'shoplifting': 1}
BEHAVIOUR_TARGET_LABELS = {0: 'normal', 1: 'shoplifting'}


def build_feature_vector_from_motions(motions, processed_frames, total_frames):
    if not motions:
        return None

    features = {
        'avg_motion': float(np.mean(motions)),
        'max_motion': float(np.max(motions)),
        'min_motion': float(np.min(motions)),
        'motion_std': float(np.std(motions)),
        'motion_median': float(np.median(motions)),
        'motion_variance': float(np.var(motions)),
        'motion_range': float(np.max(motions) - np.min(motions)),
        'motion_skew': float(pd.Series(motions).skew()) if len(motions) > 2 else 0.0,
        'motion_kurtosis': float(pd.Series(motions).kurtosis()) if len(motions) > 3 else 0.0,
        'activity_score': float(np.mean(motions) * (processed_frames / total_frames if total_frames > 0 else 0.0)),
        'high_motion_ratio': float(sum(1 for m in motions if m > 20) / len(motions)) if motions else 0.0,
        'low_motion_ratio': float(sum(1 for m in motions if m < 5) / len(motions)) if motions else 0.0,
        'motion_peaks': float(_count_peaks(motions)),
        'motion_trend': float(_calculate_trend(motions)),
    }
    ordered = [features.get(name, 0.0) for name in BEHAVIOUR_FEATURE_COLUMNS]
    return np.asarray(ordered, dtype=float).reshape(1, -1)


def _count_peaks(motions, threshold=1.5):
    if len(motions) < 3:
        return 0
    peaks = 0
    for i in range(1, len(motions) - 1):
        if motions[i] > motions[i-1] * threshold and motions[i] > motions[i+1] * threshold:
            peaks += 1
    return peaks


def _calculate_trend(motions):
    if len(motions) < 2:
        return 0
    first_half = np.mean(motions[:len(motions)//2])
    second_half = np.mean(motions[len(motions)//2:])
    return 1 if second_half > first_half else -1


def resolve_project_path(path_value):
    candidate = Path(path_value)
    if candidate.is_absolute():
        return candidate
    search_roots = [
        Path.cwd(),
        Path(__file__).resolve().parents[2],
        Path(__file__).resolve().parents[1],
    ]
    for root in search_roots:
        full_path = (root / candidate).resolve()
        if full_path.exists():
            return full_path
    return (Path.cwd() / candidate).resolve()


class BehaviourAnalyzer:
    def __init__(self, model_path="./models/behaviour_model_v2.pkl", scaler_path="./models/scaler_v2.pkl"):
        self.model = None
        self.scaler = None
        self.model_path = resolve_project_path(model_path)
        self.scaler_path = resolve_project_path(scaler_path)
        self.feature_columns = list(BEHAVIOUR_FEATURE_COLUMNS)
        self.load_model(str(self.model_path), str(self.scaler_path))

    def get_feature_columns(self):
        return list(self.feature_columns)

    def validate_feature_vector(self, feature_vector):
        if feature_vector is None:
            return False
        array = np.asarray(feature_vector, dtype=float)
        if array.ndim == 1:
            array = array.reshape(1, -1)
        if array.shape[1] != len(self.feature_columns):
            return False
        return bool(np.isfinite(array).all())

    def load_model(self, model_path, scaler_path):
        """Load the trained behaviour model."""
        try:
            model_path = str(resolve_project_path(model_path))
            scaler_path = str(resolve_project_path(scaler_path))
            if os.path.exists(model_path) and os.path.exists(scaler_path):
                self.model = joblib.load(model_path)
                self.scaler = joblib.load(scaler_path)
                scaler_features = getattr(self.scaler, 'feature_names_in_', None)
                if scaler_features is not None:
                    self.feature_columns = [str(name) for name in scaler_features.tolist()]
                logger.info("Behaviour model loaded successfully")
            else:
                logger.error("Behaviour model files were not found")
        except Exception:
            logger.exception("Failed to load behaviour model")

    def extract_features_from_video(self, video_path):
        """Extract features from a video (matching the training features)."""
        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            return None

        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        motions = []
        prev_frame = None
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
                motions.append(motion)

            prev_frame = gray

        cap.release()

        if not motions:
            return None

        features = {
            'avg_motion': float(np.mean(motions)),
            'max_motion': float(np.max(motions)),
            'min_motion': float(np.min(motions)),
            'motion_std': float(np.std(motions)),
            'motion_median': float(np.median(motions)),
            'motion_variance': float(np.var(motions)),
            'motion_range': float(np.max(motions) - np.min(motions)),
            'motion_skew': float(pd.Series(motions).skew()) if len(motions) > 2 else 0.0,
            'motion_kurtosis': float(pd.Series(motions).kurtosis()) if len(motions) > 3 else 0.0,
            'activity_score': float(np.mean(motions) * (processed / frame_count if frame_count > 0 else 0)),
            'high_motion_ratio': float(sum(1 for m in motions if m > 20) / len(motions)) if motions else 0.0,
            'low_motion_ratio': float(sum(1 for m in motions if m < 5) / len(motions)) if motions else 0.0,
            'motion_peaks': float(self.count_peaks(motions)),
            'motion_trend': float(self.calculate_trend(motions))
        }

        feature_values = [float(features.get(name, 0.0)) for name in self.feature_columns]
        return np.asarray(feature_values, dtype=float).reshape(1, -1)

    def count_peaks(self, motions, threshold=1.5):
        return _count_peaks(motions, threshold=threshold)

    def calculate_trend(self, motions):
        return _calculate_trend(motions)
    
    def predict(self, video_path):
        """Predict if a video shows normal or shoplifting behaviour."""
        features = self.extract_features_from_video(video_path)
        
        if features is None:
            return {'error': 'Could not extract features from video'}
        
        if self.model is None or self.scaler is None:
            return {
                'behaviour': 'unknown',
                'confidence': 0,
                'suspicion_score': 0,
                'error': 'Model not loaded'
            }
        
        features_scaled = self.scaler.transform(features)
        prediction = self.model.predict(features_scaled)[0]
        confidence = np.max(self.model.predict_proba(features_scaled))

        behaviour = 'shoplifting' if prediction == 1 else 'normal'
        suspicion_score = self.calculate_suspicion_score(prediction, confidence, features[0])
        
        return {
            'behaviour': behaviour,
            'confidence': float(confidence),
            'suspicion_score': suspicion_score,
            'prediction': int(prediction)
        }
    
    def calculate_suspicion_score(self, prediction, confidence, feature_row):
        """Calculate suspicion score based on prediction and motion features."""
        score = 0.0

        if prediction == 1:
            score += 50.0 * confidence

        values = np.asarray(feature_row, dtype=float).reshape(-1)
        avg_motion = float(values[self.feature_columns.index('avg_motion')]) if 'avg_motion' in self.feature_columns else 0.0
        max_motion = float(values[self.feature_columns.index('max_motion')]) if 'max_motion' in self.feature_columns else 0.0
        motion_std = float(values[self.feature_columns.index('motion_std')]) if 'motion_std' in self.feature_columns else 0.0

        if avg_motion > 5:
            score += 20.0
        if max_motion > 15:
            score += 15.0
        if motion_std > 3:
            score += 10.0

        return min(100.0, score)
