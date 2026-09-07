# Mall detector training report

This document records the detector work behind Virtual Guard's retail video-analysis pipeline. It is an experiment report, not a claim that the model is production-ready.

## Objective

The detector localizes four object classes used by downstream tracking and behaviour analysis:

| Class ID | Class | Role in the pipeline |
|---:|---|---|
| 0 | `bag` | Potential item-concealment context |
| 1 | `busket` | Shopping-container context; spelling retained for model compatibility |
| 2 | `people` | Person tracking and movement features |
| 3 | `product` | Product interaction features |

The main challenge is class imbalance and small-object detection. Products and bags occupy fewer pixels than people and are often partially occluded in surveillance footage.

## Data

The local mall-surveillance dataset contains separate training, validation and test splits. Dataset files are excluded from Git because of their size and licensing constraints. The repository retains validation utilities, training scripts, experiment configuration and selected evaluation evidence.

Before training, validate the dataset:

```powershell
cd ai-service
.\venv313\Scripts\Activate.ps1
python scripts\validate_mall_dataset.py
```

The validation process checks:

- image and label pairing;
- YOLO annotation shape and numeric ranges;
- class identifiers;
- empty or corrupt files;
- train/validation/test separation.

## Training approach

The V2 experiment fine-tuned a compact YOLO detector and preserved the behaviour classifier as an independent pipeline stage. The training workflow uses larger input images and class-aware evaluation to improve small-object performance.

Relevant files:

- `scripts/train_mall_detector_v2.py` - detector training entry point;
- `scripts/evaluate_mall_detector.py` - evaluation and sanity checks;
- `scripts/compare_mall_detectors_v1_v2.py` - model comparison;
- `PHASE5_BASELINE_MANIFEST.json` - protected artifact checksums;
- `runs/detect/virtual_guard_mall_detector_v2/` - metrics and plots;
- `models/virtual_guard_mall_detector_v2.pt` - inference weight file.

## Recorded evaluation

The preserved V2 validation run reports:

| Metric | Overall result |
|---|---:|
| Precision | 0.481 |
| Recall | 0.421 |
| mAP50 | 0.407 |
| mAP50-95 | 0.194 |

Per-class performance shows that people and baskets are substantially easier to detect than bags and products:

| Class | Precision | Recall | mAP50 | mAP50-95 |
|---|---:|---:|---:|---:|
| Bag | 0.237 | 0.126 | 0.073 | 0.020 |
| Busket | 0.663 | 0.694 | 0.638 | 0.355 |
| People | 0.697 | 0.797 | 0.827 | 0.376 |
| Product | 0.328 | 0.065 | 0.091 | 0.023 |

![V2 detector training results](runs/detect/virtual_guard_mall_detector_v2/results.png)

These results support prototype integration but do not support unattended security decisions. Low bag and product recall remains the primary model risk.

## Reproducing the evaluation

```powershell
cd ai-service
.\venv313\Scripts\Activate.ps1
python scripts\evaluate_mall_detector.py
python scripts\compare_mall_detectors_v1_v2.py
```

Hardware, package versions, random seeds and dataset versions must be recorded when generating a new comparison. Do not compare models on training data.

## Integration contract

The runtime selects the detector with `VISION_MODEL=v2`. Detection results feed lightweight object tracking, temporal feature extraction and the behaviour classifier. The API returns model output as review evidence; the Spring Boot service remains responsible for incident state and human review.

## Limitations and next steps

- Add more representative bag and product examples from the deployed camera angles.
- Evaluate small-object augmentations without contaminating the test split.
- Measure precision-recall trade-offs per class before changing thresholds.
- Test tracking stability through occlusion and crowded scenes.
- Report latency on CPU and supported GPU hardware.
- Version datasets, weights and checksums in an artifact registry.
- Monitor false positives and false negatives after any deployment pilot.

## Artifact policy

Training datasets, raw videos, checkpoints and archives are retained locally but excluded from Git. Selected metrics and plots remain in the repository for review. Large release artifacts should be distributed through Git LFS, GitHub Releases or a dedicated model registry with license and checksum metadata.
