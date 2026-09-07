#!/usr/bin/env python3
"""
Phase 5: Comprehensive Model Comparison

Evaluates both v1 and v2 models against the test set using identical methodology.
Produces detailed comparison report.

CRITICAL:
- Uses ONLY the test set (immutable)
- Does NOT modify any data
- Compares metrics objectively
- Produces evidence-based conclusions
"""
import os
import sys
from pathlib import Path
import json
from datetime import datetime
from collections import defaultdict

try:
    from ultralytics import YOLO
except ImportError:
    print("[ERROR] ERROR: ultralytics is not installed")
    sys.exit(1)

import yaml
import torch


def read_yaml_classes(yaml_path):
    """Read class names from data.yaml."""
    try:
        with open(yaml_path, 'r') as f:
            data = yaml.safe_load(f)
        return data.get('names', [])
    except Exception as e:
        print(f"[ERROR] Error reading data.yaml: {e}")
        return []


def evaluate_model(model_path, data_yaml_path, model_name, output_dir):
    """Evaluate a model on test set."""
    
    print(f"\n{'='*80}")
    print(f"EVALUATING: {model_name}")
    print(f"{'='*80}")
    
    if not Path(model_path).exists():
        print(f"[ERROR] Model not found: {model_path}")
        return None
    
    print(f"[OK] Model found: {model_path}")
    print(f"   Size: {Path(model_path).stat().st_size / (1024*1024):.2f} MB")
    
    # Load model
    try:
        model = YOLO(str(model_path))
        print(f"[OK] Model loaded successfully")
    except Exception as e:
        print(f"[ERROR] Error loading model: {e}")
        return None
    
    # Run validation on test set (validate uses test if specified in data.yaml)
    try:
        results = model.val(
            data=str(data_yaml_path),
            split="test",
            imgsz=640,  # Use 640 for consistency with v2 training
            batch=16,
            device=0 if torch.cuda.is_available() else "cpu",
            verbose=False,
            save_json=False,
            project=str(output_dir / "validation"),
            name=model_name,
            exist_ok=True,
        )
        
        print(f"[OK] Validation completed")
        
        # Extract metrics
        metrics = {
            "model": model_name,
            "precision": float(results.box.mp),
            "recall": float(results.box.mr),
            "map50": float(results.box.map50),
            "map50_95": float(results.box.map),
            "fitness": float(results.fitness),
        }
        
        # Per-class metrics
        per_class = {
            class_id: {"name": class_name, "ap50": 0.0, "ap50_95": 0.0}
            for class_id, class_name in results.names.items()
        }
        for metric_index, class_id in enumerate(results.box.ap_class_index):
            class_id = int(class_id)
            per_class[class_id] = {
                "name": results.names.get(class_id, str(class_id)),
                "ap50": float(results.box.ap50[metric_index]),
                "ap50_95": float(results.box.ap[metric_index]),
            }
        
        metrics["per_class"] = per_class
        
        return metrics
    
    except Exception as e:
        print(f"[ERROR] Error during validation: {e}")
        import traceback
        traceback.print_exc()
        return None


def compare_models():
    """Compare v1 and v2 models."""
    
    ai_service_root = Path(__file__).parent.parent
    models_dir = ai_service_root / "models"
    data_yaml_path = ai_service_root / "datasets" / "mall_surveillance" / "data.yaml"
    output_dir = ai_service_root / "runs" / "evaluation" / "v1_vs_v2"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "="*80)
    print("PHASE 5: V1 VS V2 MODEL COMPARISON")
    print("="*80)
    
    # Check models exist
    v1_path = models_dir / "virtual_guard_mall_detector_v1.pt"
    v2_path = models_dir / "virtual_guard_mall_detector_v2.pt"
    
    if not v1_path.exists():
        print(f"[ERROR] V1 model not found: {v1_path}")
        return False
    
    print(f"[OK] V1 model found: {v1_path}")
    
    if not v2_path.exists():
        print(f"[ERROR] V2 model not found: {v2_path}")
        print(f"   (Expected after training completes)")
        return False
    
    print(f"[OK] V2 model found: {v2_path}")
    
    # Evaluate both models
    v1_metrics = evaluate_model(str(v1_path), str(data_yaml_path), "v1_detector", output_dir)
    v2_metrics = evaluate_model(str(v2_path), str(data_yaml_path), "v2_detector", output_dir)
    
    if v1_metrics is None or v2_metrics is None:
        print("\n[ERROR] Evaluation failed")
        return False
    
    # Compare metrics
    print(f"\n{'='*80}")
    print("COMPARISON RESULTS")
    print(f"{'='*80}\n")
    
    # Overall metrics
    print("OVERALL METRICS:")
    print(f"{'Metric':<20} {'V1':<15} {'V2':<15} {'Change':<15}")
    print("-" * 65)
    
    for metric_name in ["precision", "recall", "map50", "map50_95"]:
        v1_val = v1_metrics.get(metric_name, 0)
        v2_val = v2_metrics.get(metric_name, 0)
        change = v2_val - v1_val
        change_pct = (change / v1_val * 100) if v1_val > 0 else 0
        print(f"{metric_name:<20} {v1_val * 100:>6.2f}%       {v2_val * 100:>6.2f}%       {change * 100:>+6.2f}pp ({change_pct:>+6.1f}%)")
    
    # Per-class metrics
    print(f"\n{'='*80}")
    print("PER-CLASS METRICS (mAP50):")
    print(f"{'Class':<15} {'V1 mAP50':<15} {'V2 mAP50':<15} {'Change':<15} {'Status':<15}")
    print("-" * 75)
    
    class_names = {0: "bag", 1: "busket", 2: "people", 3: "product"}
    
    improvements = {
        "improved": [],
        "regressed": [],
        "unchanged": []
    }
    
    for class_id, class_name in class_names.items():
        v1_ap = v1_metrics.get("per_class", {}).get(class_id, {}).get("ap50", 0)
        v2_ap = v2_metrics.get("per_class", {}).get(class_id, {}).get("ap50", 0)
        change = v2_ap - v1_ap
        
        if abs(change) < 0.005:
            status = "STABLE"
        elif change > 0:
            status = "[OK] IMPROVED"
            improvements["improved"].append((class_name, change))
        else:
            status = "[ERROR] REGRESSED"
            improvements["regressed"].append((class_name, change))
        
        print(f"{class_name:<15} {v1_ap * 100:>6.1f}%        {v2_ap * 100:>6.1f}%        {change * 100:>+6.1f}pp       {status:<15}")
    
    bag_ap = v2_metrics.get("per_class", {}).get(0, {}).get("ap50", 0)
    busket_ap = v2_metrics.get("per_class", {}).get(1, {}).get("ap50", 0)
    people_ap = v2_metrics.get("per_class", {}).get(2, {}).get("ap50", 0)
    product_ap = v2_metrics.get("per_class", {}).get(3, {}).get("ap50", 0)
    overall_ap = v2_metrics.get("map50", 0)
    minimum_met = bag_ap > 0.05 and product_ap > 0.05 and busket_ap > 0.70 and people_ap > 0.70
    target_met = bag_ap > 0.20 and product_ap > 0.15 and overall_ap > 0.35
    excellent_met = bag_ap > 0.40 and product_ap > 0.30 and overall_ap > 0.45
    decision = (
        "CANDIDATE FOR PRODUCTION" if target_met and minimum_met
        else "EXPERIMENTALLY BETTER" if minimum_met
        else "REJECTED"
    )

    # Save detailed results
    comparison = {
        "timestamp": datetime.now().isoformat(),
        "dataset": "mall_surveillance/test",
        "v1_model": str(v1_path),
        "v2_model": str(v2_path),
        "v1_metrics": v1_metrics,
        "v2_metrics": v2_metrics,
        "improvements": improvements,
        "success_criteria": {
            "minimum_met": minimum_met,
            "target_met": target_met,
            "excellent_met": excellent_met,
        },
        "decision": decision,
    }
    
    report_path = output_dir / "comparison_report.json"
    with open(report_path, 'w') as f:
        json.dump(comparison, f, indent=2)
    
    print(f"\n{'='*80}")
    print(f" Detailed report saved: {report_path}")
    print(f"{'='*80}\n")
    
    # Decision logic
    print(f"{'='*80}")
    print("DECISION:")
    print(f"{'='*80}\n")
    
    bag_improved = bag_ap > v1_metrics.get("per_class", {}).get(0, {}).get("ap50", 0)
    product_improved = product_ap > v1_metrics.get("per_class", {}).get(3, {}).get("ap50", 0)
    no_regression = all(
        v2_metrics.get("per_class", {}).get(cid, {}).get("ap50", 0) >= 
        v1_metrics.get("per_class", {}).get(cid, {}).get("ap50", 0) * 0.95
        for cid in [1, 2]  # busket and people
    )
    
    print(f"Bag improvement:     {'[OK] YES' if bag_improved else '[ERROR] NO'}")
    print(f"Product improvement: {'[OK] YES' if product_improved else '[ERROR] NO'}")
    print(f"No major regression: {'[OK] YES' if no_regression else '[ERROR] NO'}")
    
    if target_met and minimum_met:
        decision = "CANDIDATE FOR PRODUCTION"
        print(f"\n RECOMMENDATION: {decision}")
        print("\nV2 shows meaningful improvement on failed classes while maintaining")
        print("performance on working classes. Ready for integration testing.")
        return True
    elif minimum_met:
        decision = "EXPERIMENTALLY BETTER"
        print(f"\n RECOMMENDATION: {decision}")
        print("\nV2 shows improvement on minority classes but may need further")
        print("optimization. Consider additional experiments.")
        return True
    else:
        decision = "REJECTED"
        print(f"\n[ERROR] RECOMMENDATION: {decision}")
        print("\nV2 did not achieve the minimum improvement target.")
        print("Further investigation needed.")
        return False


if __name__ == "__main__":
    try:
        success = compare_models()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
