#!/usr/bin/env python3
"""
Phase 5: Comprehensive Dataset Analysis

Analyzes the mall_surveillance dataset to understand:
1. Class distribution across train/valid/test
2. Object size distribution
3. Label quality validation
4. Visual characteristics per class

This analysis is CRITICAL before retraining.
Do NOT modify the dataset. This script reads only.
"""
import os
import sys
from pathlib import Path
import json
from collections import defaultdict
import numpy as np

def analyze_dataset():
    """Perform comprehensive dataset analysis."""
    
    ai_service_root = Path(__file__).parent.parent
    dataset_root = ai_service_root / "datasets" / "mall_surveillance"
    
    print("\n" + "="*80)
    print("PHASE 5: COMPREHENSIVE DATASET ANALYSIS")
    print("="*80)
    
    # Expected classes
    class_names = {0: "bag", 1: "busket", 2: "people", 3: "product"}
    
    analysis = {
        "dataset_root": str(dataset_root),
        "classes": class_names,
        "splits": {}
    }
    
    # Analyze each split
    for split in ["train", "valid", "test"]:
        print(f"\n Analyzing {split.upper()} split...")
        
        split_analysis = analyze_split(dataset_root, split, class_names)
        analysis["splits"][split] = split_analysis
        
        # Print summary
        print(f"\n  Total images:     {split_analysis['total_images']}")
        print(f"  Total instances:  {split_analysis['total_instances']}")
        print(f"  Total labels:     {split_analysis['total_labels']}")
        
        if split_analysis['issues']:
            print(f"  Issues found:     {len(split_analysis['issues'])}")
        
        print(f"\n Per-class distribution:")
        for cls_id in sorted(class_names.keys()):
            cls_name = class_names[cls_id]
            cls_stats = split_analysis['per_class'].get(cls_id, {})
            instances = cls_stats.get('instances', 0)
            images = cls_stats.get('images', 0)
            pct_instances = (instances / split_analysis['total_instances'] * 100) if split_analysis['total_instances'] > 0 else 0
            print(f"    {cls_name:10} - instances: {instances:5} ({pct_instances:5.1f}%) images: {images:4}")
        
        print(f"\n  Object size analysis (per class):")
        for cls_id in sorted(class_names.keys()):
            cls_name = class_names[cls_id]
            cls_stats = split_analysis['per_class'].get(cls_id, {})
            sizes = cls_stats.get('object_sizes', [])
            if sizes:
                areas = np.array([s['area'] for s in sizes])
                widths = np.array([s['width'] for s in sizes])
                heights = np.array([s['height'] for s in sizes])
                aspects = np.array([s['aspect_ratio'] for s in sizes])
                
                print(f"    {cls_name}:")
                print(f"      Area:          min={areas.min():.4f} max={areas.max():.4f} mean={areas.mean():.4f} std={areas.std():.4f}")
                print(f"      Width:         min={widths.min():.4f} max={widths.max():.4f} mean={widths.mean():.4f}")
                print(f"      Height:        min={heights.min():.4f} max={heights.max():.4f} mean={heights.mean():.4f}")
                print(f"      Aspect ratio:  min={aspects.min():.2f} max={aspects.max():.2f} mean={aspects.mean():.2f}")
    
    # Save analysis report
    report_path = ai_service_root / "runs" / "data_analysis" / "mall_detector_v2" / "dataset_analysis.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(report_path, 'w') as f:
        json.dump(analysis, f, indent=2, default=str)
    
    print(f"\n" + "="*80)
    print(f" Analysis saved to: {report_path}")
    print("="*80 + "\n")
    
    return analysis

def analyze_split(dataset_root, split, class_names):
    """Analyze a single split (train/valid/test)."""
    
    split_dir = dataset_root / split
    img_dir = split_dir / "images"
    lbl_dir = split_dir / "labels"
    
    split_analysis = {
        'split': split,
        'total_images': 0,
        'total_instances': 0,
        'total_labels': 0,
        'per_class': defaultdict(lambda: {
            'instances': 0,
            'images': 0,
            'object_sizes': []
        }),
        'issues': [],
        'label_quality': {
            'valid': 0,
            'invalid': 0,
            'out_of_bounds': 0,
            'empty': 0
        }
    }
    
    if not img_dir.exists() or not lbl_dir.exists():
        split_analysis['issues'].append(f"Missing directory: {split}")
        return split_analysis
    
    # Iterate through images
    image_files = sorted([f for f in img_dir.iterdir() if f.suffix.lower() in {'.jpg', '.jpeg', '.png'}])
    split_analysis['total_images'] = len(image_files)
    
    images_with_each_class = set()
    
    for img_file in image_files:
        lbl_file = lbl_dir / f"{img_file.stem}.txt"
        
        if not lbl_file.exists():
            split_analysis['issues'].append(f"Missing label: {img_file.name}")
            split_analysis['label_quality']['invalid'] += 1
            continue
        
        if lbl_file.stat().st_size == 0:
            split_analysis['label_quality']['empty'] += 1
            continue
        
        # Read labels
        try:
            with open(lbl_file, 'r') as f:
                lines = f.readlines()
            
            split_analysis['total_labels'] += 1
            
            for line in lines:
                parts = line.strip().split()
                if len(parts) < 5:
                    split_analysis['issues'].append(f"Invalid label format: {img_file.name}")
                    split_analysis['label_quality']['invalid'] += 1
                    continue
                
                try:
                    cls_id = int(parts[0])
                    x_center = float(parts[1])
                    y_center = float(parts[2])
                    width = float(parts[3])
                    height = float(parts[4])
                    
                    # Validate bounds
                    if not (0 <= x_center <= 1 and 0 <= y_center <= 1 and 0 < width <= 1 and 0 < height <= 1):
                        split_analysis['issues'].append(f"Out of bounds: {img_file.name} class {cls_id}")
                        split_analysis['label_quality']['out_of_bounds'] += 1
                        continue
                    
                    # Check edges
                    x_min = x_center - width / 2
                    x_max = x_center + width / 2
                    y_min = y_center - height / 2
                    y_max = y_center + height / 2
                    
                    if x_min < 0 or x_max > 1 or y_min < 0 or y_max > 1:
                        split_analysis['issues'].append(f"Box exceeds bounds: {img_file.name}")
                        split_analysis['label_quality']['out_of_bounds'] += 1
                    
                    split_analysis['total_instances'] += 1
                    split_analysis['per_class'][cls_id]['instances'] += 1
                    split_analysis['label_quality']['valid'] += 1
                    
                    # Record image containing this class
                    images_with_each_class.add((img_file.name, cls_id))
                    
                    # Record object size
                    area = width * height
                    aspect_ratio = width / height if height > 0 else 0
                    split_analysis['per_class'][cls_id]['object_sizes'].append({
                        'width': width,
                        'height': height,
                        'area': area,
                        'aspect_ratio': aspect_ratio
                    })
                
                except (ValueError, IndexError) as e:
                    split_analysis['issues'].append(f"Parse error: {img_file.name} - {str(e)}")
                    split_analysis['label_quality']['invalid'] += 1
        
        except Exception as e:
            split_analysis['issues'].append(f"Error reading {lbl_file.name}: {str(e)}")
    
    # Count images per class
    for img_name, cls_id in images_with_each_class:
        split_analysis['per_class'][cls_id]['images'] += 1
    
    # Convert defaultdict to dict for JSON serialization
    split_analysis['per_class'] = dict(split_analysis['per_class'])
    
    return split_analysis

if __name__ == "__main__":
    try:
        analysis = analyze_dataset()
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
