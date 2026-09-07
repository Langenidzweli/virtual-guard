#!/usr/bin/env python3
"""
Phase 5: Train Mall Detector V2

Training script for improved custom mall YOLO detector.

CRITICAL DESIGN DECISIONS:
1. Base model: yolov8n.pt (NOT v1)
2. Image size: 640 (UP from 416 for small objects)
3. Epochs: 100 (NOT 5 - allow full convergence)
4. Patience: 20 (reasonable early stopping)
5. Augmentation: enabled (mosaic, mixup)
6. Output: virtual_guard_mall_detector_v2.pt (NEVER overwrite v1)

This experiment addresses identified root causes:
- Small object size (640px image size helps)
- Early stopping (100 epochs allows convergence)
- Limited augmentation (mosaic + mixup for diversity)

IMMUTABLE CONSTRAINT:
- Do NOT touch behaviour model
- Do NOT modify original dataset
- Do NOT overwrite v1 model
"""
import os
import sys
import shutil
import hashlib
from pathlib import Path
import json
from datetime import datetime

AI_SERVICE_ROOT = Path(__file__).parent.parent
ULTRALYTICS_CONFIG_DIR = AI_SERVICE_ROOT / ".ultralytics"
ULTRALYTICS_CONFIG_DIR.mkdir(exist_ok=True)
os.environ.setdefault("YOLO_CONFIG_DIR", str(ULTRALYTICS_CONFIG_DIR))

try:
    from ultralytics import YOLO
except ImportError:
    print("[ERROR] ERROR: ultralytics is not installed")
    sys.exit(1)

import torch


def print_config(config):
    """Pretty-print training configuration."""
    print("\n" + "="*80)
    print("TRAINING CONFIGURATION (V2 - PHASE 5)")
    print("="*80)
    for key, value in config.items():
        print(f"  {key:30} {value}")
    print("="*80 + "\n")


def validate_prerequisites(experiment_dir):
    """Validate all prerequisites before training."""
    print("\n" + "="*80)
    print("PRE-TRAINING VALIDATION")
    print("="*80)

    
    # Check Ultralytics version
    import ultralytics
    print(f"[OK] ultralytics version: {ultralytics.__version__}")
    
    # Check PyTorch
    print(f"[OK] PyTorch version: {torch.__version__}")
    
    # Check device
    if torch.cuda.is_available():
        device_name = torch.cuda.get_device_name(0)
        print(f"[OK] CUDA available: {device_name}")
        device = "cuda"
    else:
        print("[WARNING]️  CUDA not available, will use CPU (slower but still works)")
        device = "cpu"
    
    ai_service_root = AI_SERVICE_ROOT

    # Verify every protected model against the immutable Phase 5 manifest.
    manifest_path = ai_service_root / "PHASE5_BASELINE_MANIFEST.json"
    if not manifest_path.is_file():
        print(f"[ERROR] Baseline manifest missing: {manifest_path}")
        return False, None, None
    with manifest_path.open(encoding="utf-8") as manifest_file:
        protected_artifacts = json.load(manifest_file).get("artifacts", {})
    for artifact_name, metadata in protected_artifacts.items():
        artifact_path = ai_service_root / "models" / artifact_name
        if not artifact_path.is_file():
            print(f"[ERROR] Protected artifact missing: {artifact_path}")
            return False, None, None
        digest = hashlib.sha256(artifact_path.read_bytes()).hexdigest()
        if digest != metadata.get("sha256"):
            print(f"[ERROR] Protected artifact changed: {artifact_path}")
            return False, None, None
    print(f"[OK] Protected artifact hashes verified: {len(protected_artifacts)} files")

    # Check base model
    base_model_path = ai_service_root / "models" / "yolov8n.pt"
    if base_model_path.exists():
        print(f"[OK] Base model exists: {base_model_path} ({base_model_path.stat().st_size / (1024*1024):.2f} MB)")
    else:
        print(f"[ERROR] Base model not found: {base_model_path}")
        return False, None, None
    
    # Check v1 still exists (protection check)
    v1_model = ai_service_root / "models" / "virtual_guard_mall_detector_v1.pt"
    if v1_model.exists():
        print(f"[OK] V1 model protected: exists and unchanged")
    else:
        print(f"[WARNING]️  V1 model missing (unexpected)")
    
    # Check behaviour models untouched
    behaviour_model = ai_service_root / "models" / "behaviour_model_v2.pkl"
    scaler_model = ai_service_root / "models" / "scaler_v2.pkl"
    if behaviour_model.exists() and scaler_model.exists():
        print(f"[OK] Behaviour models protected: untouched")
    else:
        print(f"[WARNING]️  Behaviour models not found (unexpected)")
    
    # Check data.yaml
    data_yaml_path = ai_service_root / "datasets" / "mall_surveillance" / "data.yaml"
    if data_yaml_path.exists():
        print(f"[OK] data.yaml exists: {data_yaml_path}")
    else:
        print(f"[ERROR] data.yaml not found: {data_yaml_path}")
        return False, None, None
    
    # Check dataset exists
    train_dir = data_yaml_path.parent / "train" / "images"
    valid_dir = data_yaml_path.parent / "valid" / "images"
    test_dir = data_yaml_path.parent / "test" / "images"
    
    if train_dir.exists() and valid_dir.exists() and test_dir.exists():
        train_count = len(list(train_dir.glob("*.jpg")) + list(train_dir.glob("*.png")))
        valid_count = len(list(valid_dir.glob("*.jpg")) + list(valid_dir.glob("*.png")))
        test_count = len(list(test_dir.glob("*.jpg")) + list(test_dir.glob("*.png")))
        print(f"[OK] Dataset verified:")
        print(f"   Train: {train_count} images")
        print(f"   Valid: {valid_count} images")
        print(f"   Test:  {test_count} images")
    else:
        print(f"[ERROR] Dataset directories not found")
        return False, None, None
    
    # Resume requires the existing experiment and checkpoint. Never create or
    # replace either one automatically.
    resume_checkpoint = experiment_dir / "weights" / "last.pt"
    if not experiment_dir.is_dir():
        print(f"[ERROR] Existing V2 run not found: {experiment_dir}")
        return False, None, None
    if not resume_checkpoint.is_file():
        print(f"[ERROR] Resume checkpoint missing: {resume_checkpoint}")
        return False, None, None
    print(f"[OK] Resume checkpoint exists: {resume_checkpoint}")
    
    print("="*80 + "\n")
    return True, device, resume_checkpoint


def train_mall_detector_v2():
    """Train the improved mall detector model V2."""
    
    ai_service_root = AI_SERVICE_ROOT
    output_dir = ai_service_root / "runs" / "detect"
    experiment_dir = output_dir / "virtual_guard_mall_detector_v2"

    valid, device, resume_checkpoint = validate_prerequisites(experiment_dir)
    if not valid:
        print("[ERROR] Validation failed, aborting training")
        return False
    
    # Paths
    base_model_path = ai_service_root / "models" / "yolov8n.pt"
    data_yaml_path = ai_service_root / "datasets" / "mall_surveillance" / "data.yaml"
    output_model_path = ai_service_root / "models" / "virtual_guard_mall_detector_v2.pt"
    output_dir = ai_service_root / "runs" / "detect"
    experiment_dir = output_dir / "virtual_guard_mall_detector_v2"

    # Convert to absolute paths
    data_yaml_path = data_yaml_path.resolve()
    resume_checkpoint = resume_checkpoint.resolve()
    
    # Training configuration (PHASE 5 OPTIMIZED)
    config = {
        "model": str(resume_checkpoint),
        "base_model": str(base_model_path),
        "data": str(data_yaml_path),
        "output": str(output_model_path),
        "image_size": 640,  # INCREASED from 416 for small objects
        "epochs": 100,  # INCREASED from 5 for full convergence
        "batch_size": 16,  # Conservative for CPU
        "patience": 20,  # Early stopping patience
        "device": device,
        "optimizer": "SGD",
        "lr": 0.01,
        "augmentation": "enabled (mosaic, mixup, fliplr, flipud, translate, scale, hsv)",
        "mosaic": 1.0,  # Enable mosaic augmentation
        "mixup": 0.1,  # Enable mixup
        "hypothesis": "Small objects + early stopping + limited augmentation caused v1 failure",
        "expected_improvement": "30-50% on bag/product via larger image size + extended training",
    }
    
    print_config(config)
    print("\n" + "="*80)
    print("RESUME MODE")
    print("="*80)
    print(f"Run: {experiment_dir}")
    print(f"Checkpoint: {resume_checkpoint}")
    print("Resume: True")
    print(f"Checkpoint verified: {resume_checkpoint.is_file()}")
    print("="*80 + "\n")
    
    # Load the interrupted run checkpoint, never the base model.
    print(" Loading resume checkpoint...")
    model = YOLO(str(resume_checkpoint))
    print(f"[OK] Resume checkpoint loaded: {resume_checkpoint}")
    
    # Train
    print("\n" + "="*80)
    print(" STARTING TRAINING")
    print("="*80 + "\n")
    
    results = model.train(
        data=str(data_yaml_path),
        epochs=config["epochs"],
        imgsz=config["image_size"],
        batch=config["batch_size"],
        patience=config["patience"],
        device=0 if device == "cuda" else "cpu",
        optimizer="SGD",
        lr0=config["lr"],
        # Augmentation
        mosaic=config["mosaic"],
        mixup=config["mixup"],
        fliplr=0.5,
        flipud=0.5,
        translate=0.1,
        scale=0.5,
        hsv_h=0.015,
        hsv_s=0.7,
        hsv_v=0.4,
        # Training behavior
        verbose=True,
        save=True,
        save_period=5,
        cache=False,
        # Model
        resume=True,
        # Validation
        val=True,
        # Directory
        name="virtual_guard_mall_detector_v2",
        project=str(output_dir),
        exist_ok=True,
    )
    
    print("\n" + "="*80)
    print("[OK] TRAINING COMPLETED")
    print("="*80 + "\n")
    
    # Check if model was created
    best_model_path = experiment_dir / "weights" / "best.pt"
    if best_model_path.exists():
        print(f"[OK] Best model saved: {best_model_path}")
        
        # Copy to models directory as v2
        shutil.copy(str(best_model_path), str(output_model_path))
        print(f"[OK] Model copied to: {output_model_path}")
        print(f"   Size: {output_model_path.stat().st_size / (1024*1024):.2f} MB")
    else:
        print(f"[ERROR] Best model not found at {best_model_path}")
        return False
    
    # Save experiment metadata
    metadata = {
        "experiment": "Phase 5 Mall Detector V2",
        "timestamp": datetime.now().isoformat(),
        "configuration": config,
        "base_model": "yolov8n.pt",
        "dataset": "mall_surveillance",
        "training_time": "See runs/detect/virtual_guard_mall_detector_v2/",
        "model_output": str(output_model_path),
        "results_dir": str(experiment_dir),
    }
    
    metadata_path = experiment_dir / "metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"\n[OK] Metadata saved: {metadata_path}")
    
    # Save training configuration for reference
    config_path = experiment_dir / "training_config.json"
    with open(config_path, 'w') as f:
        json.dump(config, f, indent=2)
    print(f"[OK] Training config saved: {config_path}")
    
    return True


if __name__ == "__main__":
    try:
        success = train_mall_detector_v2()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERROR] TRAINING ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
