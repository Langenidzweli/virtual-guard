import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score
import joblib
import os

def train_behaviour_model():
    """Train behaviour classification model."""
    
    # Load features
    df = pd.read_csv('./datasets/features/video_features.csv')
    print(f" Loaded {len(df)} videos")
    
    # Features to use
    feature_columns = ['avg_motion', 'max_motion', 'motion_std', 'activity_score']
    
    # Prepare data
    X = df[feature_columns].fillna(0)
    y = df['label']
    
    # Encode labels: 'normal' = 0, 'shoplifting' = 1
    y = y.map({'normal': 0, 'shoplifting': 1})
    
    print(f" Normal: {sum(y == 0)}, Shoplifting: {sum(y == 1)}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # Scale features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train model
    model = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42)
    model.fit(X_train_scaled, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test_scaled)
    accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\n[OK] Accuracy: {accuracy:.4f}")
    print("\n Classification Report:")
    print(classification_report(y_test, y_pred, target_names=['normal', 'shoplifting']))
    
    # Save model
    os.makedirs('./models', exist_ok=True)
    joblib.dump(model, './models/behaviour_model.pkl')
    joblib.dump(scaler, './models/scaler.pkl')
    
    print("\n[OK] Model saved to ./models/behaviour_model.pkl")

if __name__ == "__main__":
    train_behaviour_model()