#!/usr/bin/env python3
"""
Phase 5: Visual Dataset Analysis

Generates visual examples of each class with bounding boxes to verify:
1. Labels are correctly placed
2. Objects are visible and recognizable
3. Classes are correctly identified
4. No systematic labeling errors
"""
import os
import sys
from pathlib import Path
import cv2
import numpy as np
from collections import defaultdict
import random

def get_images_by_class(dataset_root, split, class_names, max_per_class=10):
    """Get sample images for each class."""
    split_dir = dataset_root / split / "images"
    lbl_dir = dataset_root / split / "labels"
    
    class_images = defaultdict(list)
    
    image_files = sorted([f for f in split_dir.iterdir() if f.suffix.lower() in {'.jpg', '.jpeg', '.png'}])
    
    for img_file in image_files:
        lbl_file = lbl_dir / f"{img_file.stem}.txt"
        
        if not lbl_file.exists() or lbl_file.stat().st_size == 0:
            continue
        
        with open(lbl_file, 'r') as f:
            lines = f.readlines()
        
        found_classes = set()
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 1:
                try:
                    cls_id = int(parts[0])
                    found_classes.add(cls_id)
                except ValueError:
                    pass
        
        for cls_id in found_classes:
            if len(class_images[cls_id]) < max_per_class:
                class_images[cls_id].append(img_file)
    
    return class_images

def draw_boxes_on_image(img_path, lbl_path, class_names, class_colors):
    """Draw bounding boxes on image."""
    img = cv2.imread(str(img_path))
    if img is None:
        return None
    
    h, w = img.shape[:2]
    
    with open(lbl_path, 'r') as f:
        lines = f.readlines()
    
    for line in lines:
        parts = line.strip().split()
        if len(parts) < 5:
            continue
        
        try:
            cls_id = int(parts[0])
            x_center = float(parts[1])
            y_center = float(parts[2])
            box_width = float(parts[3])
            box_height = float(parts[4])
            
            # Convert to pixel coordinates
            x1 = int((x_center - box_width / 2) * w)
            y1 = int((y_center - box_height / 2) * h)
            x2 = int((x_center + box_width / 2) * w)
            y2 = int((y_center + box_height / 2) * h)
            
            # Clamp to image bounds
            x1 = max(0, x1)
            y1 = max(0, y1)
            x2 = min(w, x2)
            y2 = min(h, y2)
            
            cls_name = class_names.get(cls_id, str(cls_id))
            color = class_colors.get(cls_id, (0, 255, 0))
            
            # Draw box
            cv2.rectangle(img, (x1, y1), (x2, y2), color, 2)
            
            # Draw label
            label = f"{cls_name} ({cls_id})"
            cv2.putText(img, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        except (ValueError, IndexError):
            pass
    
    return img

def generate_visual_analysis():
    """Generate visual analysis for each class."""
    
    ai_service_root = Path(__file__).parent.parent
    dataset_root = ai_service_root / "datasets" / "mall_surveillance"
    output_dir = ai_service_root / "runs" / "data_analysis" / "mall_detector_v2" / "visual_examples"
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("\n" + "="*80)
    print("PHASE 5: VISUAL DATASET ANALYSIS")
    print("="*80)
    
    class_names = {0: "bag", 1: "busket", 2: "people", 3: "product"}
    class_colors = {
        0: (0, 0, 255),      # Red for bag
        1: (0, 165, 255),    # Orange for busket
        2: (0, 255, 0),      # Green for people
        3: (255, 0, 0)       # Blue for product
    }
    
    # Analyze each split
    for split in ["train", "test"]:
        print(f"\n Generating visual examples for {split.upper()}...")
        
        class_images = get_images_by_class(dataset_root, split, class_names, max_per_class=10)
        
        split_output = output_dir / split
        split_output.mkdir(parents=True, exist_ok=True)
        
        for cls_id in sorted(class_names.keys()):
            cls_name = class_names[cls_id]
            images = class_images.get(cls_id, [])
            
            if not images:
                print(f"  {cls_name}: No images found")
                continue
            
            # Create a grid of examples
            grid_cols = 5
            grid_rows = (len(images) + grid_cols - 1) // grid_cols
            
            print(f"  {cls_name}: Creating grid with {len(images)} examples ({grid_rows}x{grid_cols})")
            
            drawn_images = []
            for img_file in images:
                lbl_file = dataset_root / split / "labels" / f"{img_file.stem}.txt"
                drawn_img = draw_boxes_on_image(img_file, lbl_file, class_names, class_colors)
                if drawn_img is not None:
                    drawn_images.append(drawn_img)
            
            if drawn_images:
                # Resize all to same size for grid
                target_h, target_w = 200, 250
                resized = []
                for img in drawn_images:
                    h, w = img.shape[:2]
                    aspect = w / h
                    
                    if aspect > target_w / target_h:
                        new_w = target_w
                        new_h = int(target_w / aspect)
                    else:
                        new_h = target_h
                        new_w = int(target_h * aspect)
                    
                    resized_img = cv2.resize(img, (new_w, new_h))
                    
                    # Pad to target size
                    canvas = np.zeros((target_h, target_w, 3), dtype=np.uint8)
                    y_offset = (target_h - resized_img.shape[0]) // 2
                    x_offset = (target_w - resized_img.shape[1]) // 2
                    canvas[y_offset:y_offset+resized_img.shape[0], 
                           x_offset:x_offset+resized_img.shape[1]] = resized_img
                    resized.append(canvas)
                
                # Create grid
                grid = []
                for row in range(grid_rows):
                    row_images = resized[row*grid_cols:(row+1)*grid_cols]
                    while len(row_images) < grid_cols:
                        row_images.append(np.zeros((target_h, target_w, 3), dtype=np.uint8))
                    row_img = np.hstack(row_images)
                    grid.append(row_img)
                
                grid_img = np.vstack(grid)
                
                # Save grid
                output_file = split_output / f"{cls_name}_examples.jpg"
                cv2.imwrite(str(output_file), grid_img)
                print(f"    [OK] Saved: {output_file.name}")
    
    print(f"\n" + "="*80)
    print(f" Visual examples saved to: {output_dir}")
    print("="*80 + "\n")

if __name__ == "__main__":
    try:
        import cv2
    except ImportError:
        print("[ERROR] OpenCV not installed. Installing...")
        os.system("pip install opencv-python -q")
    
    try:
        generate_visual_analysis()
        sys.exit(0)
    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
