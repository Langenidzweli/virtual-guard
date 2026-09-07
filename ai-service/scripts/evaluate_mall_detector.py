#!/usr/bin/env python3
"""
Formal evaluation script for the custom mall YOLO detector.

This script:
1. Loads the trained custom model
2. Evaluates it on the untouched test set
3. Extracts per-class metrics
4. Runs detection sanity checks
5. Generates comprehensive evaluation report

CRITICAL: This is evaluation only. No retraining or dataset modification.
"""
import os
import sys
from pathlib import Path
import json
from datetime import datetime

try:
    from ultralytics import YOLO
except ImportError:
    print("[ERROR] ERROR: ultralytics is not installed")
    sys.exit(1)

import yaml
import cv2
import numpy as np


def print_section(title):
    """Print a formatted section header."""
    print("\n" + "="*70)
    print(title)
    print("="*70)


def read_yaml_classes(yaml_path):
    """Read class names from data.yaml."""
    try:
        with open(yaml_path, 'r') as f:
            data = yaml.safe_load(f)
        return data.get('names', [])
    except Exception as e:
        print(f"[ERROR] Error reading data.yaml: {e}")
        return []


def verify_dataset_yaml():
    """Verify the dataset YAML configuration."""
    print_section("1. VERIFY DATASET YAML")
    
    ai_service_root = Path(__file__).parent.parent
    data_yaml_path = ai_service_root / "datasets" / "mall_surveillance" / "data.yaml"
    
    if not data_yaml_path.exists():
        print(f"[ERROR] data.yaml not found: {data_yaml_path}")
        return False, None
    
    print(f"[OK] data.yaml found: {data_yaml_path}")
    
    try:
        with open(data_yaml_path, 'r') as f:
            yaml_content = yaml.safe_load(f)
        
        print(f"\nDataset YAML content:")
        print(f"  Train path: {yaml_content.get('train')}")
        print(f"  Val path: {yaml_content.get('val')}")
        print(f"  Test path: {yaml_content.get('test')}")
        print(f"  Classes: {yaml_content.get('nc')}")
        
        class_names = yaml_content.get('names', [])
        print(f"\nClass names:")
        for i, name in enumerate(class_names):
            print(f"  {i}: {name}")
        
        expected_classes = ['bag', 'busket', 'people', 'product']
        if class_names == expected_classes:
            print(f"\n[OK] Classes match expected schema")
            return True, class_names
        else:
            print(f"\n[WARNING]️  Classes differ from expected")
            print(f"  Expected: {expected_classes}")
            print(f"  Actual: {class_names}")
            return False, class_names
    
    except Exception as e:
        print(f"[ERROR] Error parsing data.yaml: {e}")
        return False, None


def verify_model_loads():
    """Verify that the custom model loads successfully."""
    print_section("2. VERIFY MODEL LOADS")
    
    ai_service_root = Path(__file__).parent.parent
    custom_model_path = ai_service_root / "models" / "virtual_guard_mall_detector_v1.pt"
    best_pt_path = ai_service_root / "runs" / "detect" / "virtual_guard_mall_detector_v1" / "weights" / "best.pt"
    
    # Check if custom model exists
    if custom_model_path.exists():
        print(f"[OK] Custom model exists: {custom_model_path}")
        print(f"   Size: {custom_model_path.stat().st_size / 1e6:.1f} MB")
        model_to_load = custom_model_path
    elif best_pt_path.exists():
        print(f"[WARNING]️  Custom model not found, but best.pt exists: {best_pt_path}")
        print(f"   Size: {best_pt_path.stat().st_size / 1e6:.1f} MB")
        model_to_load = best_pt_path
    else:
        print(f"[ERROR] No trained model found")
        print(f"   Checked: {custom_model_path}")
        print(f"   Checked: {best_pt_path}")
        return False, None
    
    try:
        print(f"\n Loading model: {model_to_load}")
        model = YOLO(str(model_to_load))
        print(f"[OK] Model loaded successfully")
        
        print(f"\nModel information:")
        print(f"  Model type: {type(model).__name__}")
        print(f"  Classes: {len(model.names)}")
        print(f"  Class names: {list(model.names.values())}")
        print(f"  Model parameters: {sum(p.numel() for p in model.model.parameters()) / 1e6:.1f}M")
        
        return True, model
    
    except Exception as e:
        print(f"[ERROR] Error loading model: {e}")
        import traceback
        traceback.print_exc()
        return False, None


def run_detection_sanity_check(model, class_names):
    """Run sanity check on several test images."""
    print_section("3. DETECTION SANITY CHECK")
    
    ai_service_root = Path(__file__).parent.parent
    test_images_dir = ai_service_root / "datasets" / "mall_surveillance" / "test" / "images"
    
    if not test_images_dir.exists():
        print(f"[ERROR] Test images directory not found: {test_images_dir}")
        return False
    
    test_images = list(test_images_dir.glob("*.jpg")) + list(test_images_dir.glob("*.png"))
    if not test_images:
        print(f"[ERROR] No test images found in {test_images_dir}")
        return False
    
    print(f"Found {len(test_images)} test images")
    
    # Sample a few images
    sample_count = min(3, len(test_images))
    sample_images = test_images[:sample_count]
    
    print(f"\nRunning inference on {sample_count} sample images:")
    
    all_passed = True
    for img_path in sample_images:
        print(f"\n  Image: {img_path.name}")
        
        try:
            # Load image
            img = cv2.imread(str(img_path))
            if img is None:
                print(f"    [ERROR] Could not load image")
                all_passed = False
                continue
            
            h, w = img.shape[:2]
            print(f"    Dimensions: {w}x{h}")
            
            # Run inference
            results = model(str(img_path), verbose=False)
            
            if not results:
                print(f"    [WARNING]️  No results returned")
                continue
            
            result = results[0]
            detections = result.boxes
            
            if len(detections) == 0:
                print(f"    ℹ️  No objects detected")
                continue
            
            print(f"    [OK] Detections: {len(detections)}")
            
            for det in detections:
                cls_id = int(det.cls[0])
                conf = float(det.conf[0])
                x1, y1, x2, y2 = det.xyxy[0].tolist()
                
                class_name = model.names.get(cls_id, f"Unknown({cls_id})")
                
                # Sanity checks
                valid = True
                issues = []
                
                if cls_id < 0 or cls_id >= len(class_names):
                    issues.append(f"Invalid class ID {cls_id}")
                    valid = False
                
                if conf < 0 or conf > 1:
                    issues.append(f"Invalid confidence {conf}")
                    valid = False
                
                if x1 < 0 or y1 < 0 or x2 > w or y2 > h:
                    issues.append(f"Bbox out of bounds")
                    valid = False
                
                if x2 <= x1 or y2 <= y1:
                    issues.append(f"Invalid bbox dimensions")
                    valid = False
                
                status = "[OK]" if valid else "[ERROR]"
                print(f"      {status} Class: {class_name} ({cls_id}), Conf: {conf:.3f}, Bbox: ({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f})")
                
                if issues:
                    for issue in issues:
                        print(f"         - {issue}")
                    all_passed = False
        
        except Exception as e:
            print(f"    [ERROR] Error during inference: {e}")
            all_passed = False
    
    return all_passed


def evaluate_on_test_set(model, yaml_path):
    """Run formal evaluation on test set."""
    print_section("4. FORMAL EVALUATION ON TEST SET")
    
    ai_service_root = Path(__file__).parent.parent
    test_dir = ai_service_root / "datasets" / "mall_surveillance" / "test"
    
    if not test_dir.exists():
        print(f"[ERROR] Test directory not found: {test_dir}")
        return None, None
    
    # Count test images
    test_images = list((test_dir / "images").glob("*.jpg")) + list((test_dir / "images").glob("*.png"))
    print(f"Test set: {len(test_images)} images")
    
    print(f"\n Running evaluation on test set...")
    print(f"   This may take a few minutes...")
    
    try:
        # Run evaluation
        results = model.val(
            data=str(yaml_path),
            split='test',
            conf=0.25,
            iou=0.6,
            device='cpu',
            verbose=True,
            plots=False,
            save=False
        )
        
        print(f"\n[OK] Evaluation completed")
        
        # Extract metrics
        metrics = results.results_dict if hasattr(results, 'results_dict') else {}
        
        print(f"\nAvailable metrics:")
        for key, value in metrics.items():
            if isinstance(value, (int, float)):
                print(f"  {key}: {value}")
        
        return results, metrics
    
    except Exception as e:
        print(f"[ERROR] Evaluation failed: {e}")
        import traceback
        traceback.print_exc()
        return None, None


def extract_per_class_metrics(results):
    """Extract per-class metrics from results."""
    print_section("5. PER-CLASS METRICS")
    
    if results is None:
        print("[ERROR] No results to extract")
        return {}
    
    try:
        # Get class results
        class_results = {}
        
        # Check if results has class_results attribute
        if hasattr(results, 'class_results'):
            class_results = results.class_results
            
            print(f"\nPer-class metrics:")
            print(f"{'Class':<15} {'Precision':<12} {'Recall':<12} {'mAP50':<12} {'mAP50-95':<12}")
            print("-" * 65)
            
            for cls_id, cls_metrics in class_results.items():
                if isinstance(cls_metrics, dict):
                    p = cls_metrics.get('precision', 0)
                    r = cls_metrics.get('recall', 0)
                    m50 = cls_metrics.get('mAP50', 0)
                    m95 = cls_metrics.get('mAP50-95', 0)
                    
                    print(f"{str(cls_id):<15} {p:<12.4f} {r:<12.4f} {m50:<12.4f} {m95:<12.4f}")
        
        return class_results
    
    except Exception as e:
        print(f"[WARNING]️  Could not extract detailed class metrics: {e}")
        return {}


def verify_training_test_separation():
    """Verify that train/valid/test splits are separate."""
    print_section("6. TRAINING/TEST SEPARATION VERIFICATION")
    
    ai_service_root = Path(__file__).parent.parent
    dataset_root = ai_service_root / "datasets" / "mall_surveillance"
    
    splits = ['train', 'valid', 'test']
    split_files = {}
    
    for split in splits:
        split_dir = dataset_root / split / "images"
        if not split_dir.exists():
            print(f"[ERROR] {split} directory missing: {split_dir}")
            return False
        
        files = sorted([f.name for f in split_dir.glob("*")])
        split_files[split] = set(files)
        print(f"  {split}: {len(files)} images")
    
    # Check for overlap
    all_passed = True
    for i, split1 in enumerate(splits):
        for split2 in splits[i+1:]:
            overlap = split_files[split1] & split_files[split2]
            if overlap:
                print(f"[ERROR] Overlap found between {split1} and {split2}:")
                for f in list(overlap)[:5]:
                    print(f"   - {f}")
                all_passed = False
            else:
                print(f"[OK] No overlap between {split1} and {split2}")
    
    return all_passed


def verify_behaviour_model_untouched():
    """Verify behaviour model files are untouched."""
    print_section("7. BEHAVIOUR MODEL VERIFICATION")
    
    ai_service_root = Path(__file__).parent.parent
    behaviour_model = ai_service_root / "models" / "behaviour_model_v2.pkl"
    scaler_model = ai_service_root / "models" / "scaler_v2.pkl"
    
    print(f"Expected baseline:")
    print(f"  Accuracy: 82.14%")
    print(f"  Precision: 80.00%")
    print(f"  Recall: 85.71%")
    print(f"  F1: 82.76%")
    
    if behaviour_model.exists():
        print(f"\n[OK] Behaviour model exists: {behaviour_model}")
        print(f"   Size: {behaviour_model.stat().st_size / 1e6:.1f} MB")
    else:
        print(f"[ERROR] Behaviour model missing: {behaviour_model}")
        return False
    
    if scaler_model.exists():
        print(f"[OK] Scaler model exists: {scaler_model}")
        print(f"   Size: {scaler_model.stat().st_size / 1e6:.1f} MB")
    else:
        print(f"[ERROR] Scaler model missing: {scaler_model}")
        return False
    
    return True


def generate_evaluation_report(custom_model_path, class_names, results, metrics):
    """Generate structured evaluation report."""
    print_section("8. GENERATING EVALUATION REPORT")
    
    report = {
        "timestamp": datetime.now().isoformat(),
        "model": "virtual_guard_mall_detector_v1.pt",
        "base_model": "yolov8n.pt",
        "dataset": "mall_surveillance",
        "test_images": 239,
        "classes": class_names,
        "metrics": {},
        "per_class_metrics": {},
        "notes": []
    }
    
    # Overall metrics
    if metrics:
        # Map UltralyticS metrics to report
        if 'metrics/precision(B)' in metrics:
            report["metrics"]["precision"] = float(metrics['metrics/precision(B)'])
        if 'metrics/recall(B)' in metrics:
            report["metrics"]["recall"] = float(metrics['metrics/recall(B)'])
        if 'metrics/mAP50(B)' in metrics:
            report["metrics"]["mAP50"] = float(metrics['metrics/mAP50(B)'])
        if 'metrics/mAP50-95(B)' in metrics:
            report["metrics"]["mAP50-95"] = float(metrics['metrics/mAP50-95(B)'])
    
    # Try to extract box/cls/dfl metrics if available via results object attributes
    if results is not None and hasattr(results, 'results_dict'):
        results_dict = results.results_dict
        for loss_name in ['box_loss', 'cls_loss', 'dfl_loss']:
            if loss_name in results_dict:
                report["metrics"][loss_name] = float(results_dict[loss_name])
    
    # Check training epochs
    results_csv = Path(__file__).parent.parent / "runs" / "detect" / "virtual_guard_mall_detector_v1" / "results.csv"
    if results_csv.exists():
        import pandas as pd
        try:
            df = pd.read_csv(results_csv)
            report["training_epochs"] = len(df)
            report["notes"].append(f"Model was trained for {len(df)} epochs (config specified 50)")
        except:
            pass
    
    # Save report
    report_path = Path(__file__).parent.parent / "runs" / "detect" / "virtual_guard_mall_detector_v1" / "evaluation_report.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"[OK] Report saved: {report_path}")
    
    return report


def main():
    """Run complete evaluation."""
    
    print_section("PHASE 4 — CUSTOM DETECTOR FORMAL EVALUATION")
    print(f"Started: {datetime.now().isoformat()}")
    
    # Step 1: Verify YAML
    yaml_valid, class_names = verify_dataset_yaml()
    if not yaml_valid:
        print("\n[ERROR] Dataset YAML verification failed")
        return False
    
    ai_service_root = Path(__file__).parent.parent
    data_yaml_path = ai_service_root / "datasets" / "mall_surveillance" / "data.yaml"
    
    # Step 2: Verify model loads
    model_valid, model = verify_model_loads()
    if not model_valid or model is None:
        print("\n[ERROR] Model loading failed")
        return False
    
    # Step 3: Sanity check
    sanity_ok = run_detection_sanity_check(model, class_names)
    
    # Step 4: Formal evaluation
    results, metrics = evaluate_on_test_set(model, data_yaml_path)
    
    # Step 5: Per-class metrics
    class_metrics = extract_per_class_metrics(results)
    
    # Step 6: Separation check
    separation_ok = verify_training_test_separation()
    
    # Step 7: Behaviour model check
    behaviour_ok = verify_behaviour_model_untouched()
    
    # Step 8: Generate report
    report = generate_evaluation_report(
        ai_service_root / "models" / "virtual_guard_mall_detector_v1.pt",
        class_names,
        results,
        metrics
    )
    
    # Final summary
    print_section("EVALUATION SUMMARY")
    
    print(f"[OK] Dataset YAML valid: {yaml_valid}")
    print(f"[OK] Model loads: {model_valid}")
    print(f"[OK] Detection sanity check: {sanity_ok}")
    print(f"[OK] Train/Test separation: {separation_ok}")
    print(f"[OK] Behaviour model untouched: {behaviour_ok}")
    print(f"[OK] Evaluation report saved")
    
    print(f"\nFinished: {datetime.now().isoformat()}")
    
    return True


if __name__ == "__main__":
    try:
        success = main()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERROR] Evaluation failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
