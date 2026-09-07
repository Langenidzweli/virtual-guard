#!/usr/bin/env python3
"""
Dataset validation script for mall surveillance dataset.
Runs comprehensive checks before training.
"""
import sys
from pathlib import Path

# Add ai-service to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.vision.dataset_validator import validate_mall_dataset


def main():
    dataset_root = Path(__file__).parent.parent / "datasets" / "mall_surveillance"
    print("\n" + "="*70)
    print("MALL DATASET VALIDATION")
    print("="*70)
    
    report = validate_mall_dataset(str(dataset_root))
    
    print(f"\nDataset: {report['dataset_root']}")
    print(f"\nTRAIN:")
    print(f"  Images:     {report['train_images']}")
    print(f"  Labels:     {report['train_labels']}")
    
    print(f"\nVALIDATION:")
    print(f"  Images:     {report['valid_images']}")
    print(f"  Labels:     {report['valid_labels']}")
    
    print(f"\nTEST:")
    print(f"  Images:     {report['test_images']}")
    print(f"  Labels:     {report['test_labels']}")
    
    print(f"\nCLASSES:")
    for i, cls_name in enumerate(report.get('class_names', [])):
        print(f"  {i}: {cls_name}")
    
    print(f"\nISSUES:")
    print(f"  Missing labels: {report['missing_labels']}")
    print(f"  Empty labels:   {report['empty_labels']}")
    print(f"  Invalid labels: {report['invalid_labels']}")
    
    print(f"\nSTATUS: {'PASS' if report['valid'] else 'FAIL'}")
    
    if report['issues']:
        print(f"\nDETAILS:")
        for issue in report['issues'][:10]:
            print(f"  - {issue}")
        if len(report['issues']) > 10:
            print(f"  ... and {len(report['issues']) - 10} more issues")
    
    print("="*70 + "\n")
    
    return 0 if report['valid'] else 1


if __name__ == "__main__":
    sys.exit(main())
