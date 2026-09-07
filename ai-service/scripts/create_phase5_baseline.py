#!/usr/bin/env python3
"""
Phase 5 Baseline Protection Script

Creates a manifest of all protected artifacts with:
- File size
- Modification timestamp
- SHA-256 hash

CRITICAL: This documents the baseline before any Phase 5 modifications.
"""
import os
import sys
from pathlib import Path
import hashlib
from datetime import datetime
import json

def compute_sha256(file_path):
    """Compute SHA-256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def get_file_info(file_path):
    """Get file size, modification time, and hash."""
    if not os.path.exists(file_path):
        return None
    
    stat = os.stat(file_path)
    return {
        "path": str(file_path),
        "size_bytes": stat.st_size,
        "size_mb": round(stat.st_size / (1024 * 1024), 2),
        "modified_timestamp": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        "sha256": compute_sha256(file_path)
    }

def main():
    ai_service_root = Path(__file__).parent.parent
    models_dir = ai_service_root / "models"
    
    print("\n" + "="*80)
    print("PHASE 5 BASELINE ARTIFACT PROTECTION")
    print("="*80)
    
    protected_artifacts = [
        models_dir / "yolov8n.pt",
        models_dir / "virtual_guard_mall_detector_v1.pt",
        models_dir / "behaviour_model_v2.pkl",
        models_dir / "scaler_v2.pkl",
    ]
    
    baseline = {
        "phase": 5,
        "created_timestamp": datetime.now().isoformat(),
        "artifacts": {}
    }
    
    all_exist = True
    for artifact_path in protected_artifacts:
        artifact_name = artifact_path.name
        print(f"\n Checking: {artifact_name}")
        
        info = get_file_info(artifact_path)
        if info:
            baseline["artifacts"][artifact_name] = info
            print(f"   [OK] Found")
            print(f"   Size:       {info['size_mb']} MB")
            print(f"   Modified:   {info['modified_timestamp']}")
            print(f"   SHA-256:    {info['sha256']}")
        else:
            print(f"   [ERROR] NOT FOUND: {artifact_path}")
            all_exist = False
    
    # Save baseline manifest
    manifest_path = ai_service_root / "PHASE5_BASELINE_MANIFEST.json"
    with open(manifest_path, 'w') as f:
        json.dump(baseline, f, indent=2)
    
    print(f"\n" + "="*80)
    print(f" Baseline manifest saved: {manifest_path}")
    print(f"="*80 + "\n")
    
    if all_exist:
        print("[OK] All protected artifacts verified and hashed.\n")
        return 0
    else:
        print("[ERROR] Some protected artifacts are missing!\n")
        return 1

if __name__ == "__main__":
    sys.exit(main())
