#!/usr/bin/env python3
"""
Training script for custom mall YOLO detector.

This script trains a YOLO model on the mall surveillance dataset.
The resulting model is saved as a separate artifact and never overwrites the baseline.

CRITICAL: This is a development/offline operation. Production deployment only loads the trained artifact.
"""
import os
import sys
from pathlib import Path

try:
    from ultralytics import YOLO
except ImportError:
    print("[ERROR] ERROR: ultralytics is not installed")
    sys.exit(1)

import torch


def print_config(config):
    """Pretty-print training configuration."""
    print("\n" + "="*70)
    print("TRAINING CONFIGURATION")
    print("="*70)
    for key, value in config.items():
        print(f"  {key:30} {value}")
    print("="*70 + "\n")


def validate_prerequisites():
    """Validate all prerequisites before training."""
    print("\n" + "="*70)
    print("PRE-TRAINING VALIDATION")
    print("="*70)
    
    # Check Ultralytics version
    import ultralytics
    print(f"[OK] ultralytics version: {ultralytics.__version__}")
    
    # Check PyTorch
    print(f"[OK] PyTorch version: {torch.__version__}")
    
    # Check CUDA
    if torch.cuda.is_available():
        print(f"[OK] CUDA available: {torch.cuda.get_device_name(0)}")
    else:
        print("[WARNING]️  CUDA not available, will use CPU (slower)")
    
    # Check base model
    base_model_path = Path(__file__).parent.parent / "models" / "yolov8n.pt"
    if base_model_path.exists():
        print(f"[OK] Base model exists: {base_model_path}")
    else:
        print(f"[ERROR] Base model not found: {base_model_path}")
        return False
    
    # Check data.yaml
    data_yaml_path = Path(__file__).parent.parent / "datasets" / "mall_surveillance" / "data.yaml"
    if data_yaml_path.exists():
        print(f"[OK] data.yaml exists: {data_yaml_path}")
    else:
        print(f"[ERROR] data.yaml not found: {data_yaml_path}")
        return False
    
    # Check output directory
    output_dir = Path(__file__).parent.parent / "runs" / "detect"
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"[OK] Output directory ready: {output_dir}")
    
    # Verify behaviour model is untouched
    behaviour_model = Path(__file__).parent.parent / "models" / "behaviour_model_v2.pkl"
    scaler_model = Path(__file__).parent.parent / "models" / "scaler_v2.pkl"
    if behaviour_model.exists():
        print(f"[OK] Behaviour model present (will not be modified)")
    if scaler_model.exists():
        print(f"[OK] Scaler model present (will not be modified)")
    
    print("="*70 + "\n")
    return True


def train_mall_detector():
    """Train the mall detector model."""
    
    if not validate_prerequisites():
        print("[ERROR] Validation failed, aborting training")
        return False
    
    # Paths
    ai_service_root = Path(__file__).parent.parent
    base_model_path = ai_service_root / "models" / "yolov8n.pt"
    data_yaml_path = ai_service_root / "datasets" / "mall_surveillance" / "data.yaml"
    output_model_path = ai_service_root / "models" / "virtual_guard_mall_detector_v1.pt"
    
    # Convert to absolute paths for training
    data_yaml_path = data_yaml_path.resolve()
    
    # Training configuration
    config = {
        "base_model": str(base_model_path),
        "dataset_yaml": str(data_yaml_path),
        "epochs": 50,
        "image_size": 416,
        "batch_size": 16,
        "device": "0" if torch.cuda.is_available() else "cpu",
        "output_model": str(output_model_path),
        "experiment_name": "virtual_guard_mall_detector_v1",
    }
    
    print_config(config)
    
    # Load base model
    print(f" Loading base model: {config['base_model']}")
    model = YOLO(str(base_model_path))
    print(f"[OK] Base model loaded\n")
    
    # Print model info
    print(f"Model summary:")
    print(f"  Base classes (COCO): {len(model.names)}")
    print(f"  Model parameters: {sum(p.numel() for p in model.model.parameters()) / 1e6:.1f}M")
    print()
    
    # Train
    print(f" Starting training on {config['device']}...")
    print(f"   Dataset: {data_yaml_path}")
    print(f"   Epochs: {config['epochs']}")
    print(f"   Image size: {config['image_size']}")
    print(f"   Batch size: {config['batch_size']}\n")
    
    results = model.train(
        data=str(data_yaml_path),
        epochs=config["epochs"],
        imgsz=config["image_size"],
        batch=config["batch_size"],
        device=config["device"],
        name=config["experiment_name"],
        project=str(ai_service_root / "runs" / "detect"),
        verbose=True,
        patience=10,  # Early stopping
        save=True,
        plots=True,
    )
    
    # Save the trained model to the target location
    print(f"\n Saving trained model to: {output_model_path}")
    trained_model_path = ai_service_root / "runs" / "detect" / config["experiment_name"] / "weights" / "best.pt"
    
    if trained_model_path.exists():
        import shutil
        shutil.copy(str(trained_model_path), str(output_model_path))
        print(f"[OK] Model saved: {output_model_path}")
    else:
        print(f"[ERROR] Trained model not found at expected location: {trained_model_path}")
        return False
    
    return True


if __name__ == "__main__":
    try:
        success = train_mall_detector()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERROR] Training failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
