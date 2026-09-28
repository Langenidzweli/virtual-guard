# Model evaluation

## Evidence and interpretation

This document separates saved training validation, detector test comparisons, stored-feature behaviour evaluation and historical timing observations. They measure different things. No training or new detector evaluation was performed for this documentation update; original weights, datasets and experiment results remain unchanged.

Primary evidence is retained under [runs](../ai-service/runs/), with code under [scripts](../ai-service/scripts/) and [training](../ai-service/training/). Historical metadata contains paths from its original workstation. Those paths are provenance, not portable commands. Some historical prose overstates integration or acceptance; the current implementation and numerical evidence take precedence.

## Object detection

### Models and runtime selection

| Artifact in `ai-service/models/` | Role |
|---|---|
| `yolov8n.pt` | Pretrained YOLOv8 nano baseline; COCO classes, not the four-class task |
| `virtual_guard_mall_detector_v1.pt` | Initial custom mall detector |
| `virtual_guard_mall_detector_v2.pt` | Later custom detector, selected by Compose and `.env.example` |
| `yolov8n-pose.pt` | Separate human-keypoint model; not the mall detector |

The raw Python configuration defaults to V1 when `VISION_MODEL` is absent. The supplied Compose configuration and environment template select `v2`. `base` and `v1` are explicit alternatives. Native `CUSTOM_MODEL_PATH` overrides selection; missing configured files raise errors rather than silently substituting a detector. Compose does not forward host-specific custom paths.

The `/analyze` route passes confidence 0.25 and defaults to approximately five sampled frames per second. It does not explicitly set inference image size or NMS IoU; Ultralytics handles preprocessing/defaults. Saved training image sizes below must not be confused with an explicit application inference setting.

### Dataset and imbalance

The mall-surveillance dataset uses YOLO labels with four classes: `0 bag`, `1 busket`, `2 people`, `3 product`. The spelling `busket` is preserved for compatibility. The saved [dataset analysis](../ai-service/runs/data_analysis/mall_detector_v2/dataset_analysis.json) records:

| Split | Images | Bag instances | Busket | People | Product | Total instances |
|---|---:|---:|---:|---:|---:|---:|
| Train | 1,120 | 534 | 810 | 4,366 | 1,123 | 6,833 |
| Validation | 239 | 95 | 36 | 473 | 216 | 820 |
| Test | 239 | 67 | 64 | 677 | 122 | 930 |

People dominate the training annotations (approximately 64%); bags contribute approximately 8%. Object count alone is insufficient: small bags/products occupy fewer pixels, often appear occluded and provide less localization detail. Increasing training image size from 416 to 640 was part of the V2 experiment. The saved per-class results still show a substantial gap between people and products.

The analysis reports valid labels with no invalid/out-of-bounds boxes. Earlier exact-file hashing found no cross-split duplicate images; this does not rule out related frames, near duplicates or scene leakage. Keep dataset attribution files. The mall metadata declares CC BY 4.0; other supplied artifacts retain their own terms. Dataset availability and redistribution rights must be checked separately from source-code licensing.

### Training configuration and best epochs

| Setting | V1 saved configuration | V2 saved configuration |
|---|---|---|
| Image size | 416 | 640 |
| Requested epochs | 50 | 100 |
| Numeric epochs present in CSV | 5 | 100 |
| Batch | 16 | 16 |
| Device | CPU | CPU |
| Patience | 10 | 20 |
| Optimizer | auto | SGD |
| Initial/final LR factor | 0.01 / 0.01 | 0.01 / 0.01 |
| Mosaic / mixup | 1.0 / 0.0 | 1.0 / 0.1 |
| Resume | false | saved `last.pt` checkpoint path |

Sources: V1 [args](../ai-service/runs/detect/virtual_guard_mall_detector_v1/args.yaml) and [results](../ai-service/runs/detect/virtual_guard_mall_detector_v1/results.csv); V2 [args](../ai-service/runs/detect/virtual_guard_mall_detector_v2/args.yaml) and [results](../ai-service/runs/detect/virtual_guard_mall_detector_v2/results.csv).

V1's highest recorded validation mAP50-95 occurs at epoch 4: precision 0.84526, recall 0.26718, mAP50 0.29896 and mAP50-95 0.13406. Only five epochs are recorded. A historical report attributes termination to early stopping, but these records alone do not establish the cause; configured patience 10 is not evidence of stopping at epoch 5.

**V2's best recorded validation epoch by mAP50-95 is epoch 61:** precision 0.48484, recall 0.42536, mAP50 0.43525 and mAP50-95 0.21596. These are validation-epoch values, not the separate test-set results below. The CSV has an unrelated prose row after its 100 numeric epochs; it was excluded from the calculation and left unchanged as original evidence. This calculation does not independently prove which epoch produced the distributed checkpoint.

The historical Phase 5 work includes dataset analysis, visual inspection, V2 training/resume and V1/V2 comparison. Preserve [PHASE5_BASELINE_MANIFEST.json](../ai-service/PHASE5_BASELINE_MANIFEST.json) and the original run artifacts as historical provenance. Superseded experiment prose has been removed; the active behaviour classifier is independent of object detections, tracks and poses. `train_mall_detector_v2.py` currently resumes a checkpoint and verifies protected artifacts; it is not a clean-checkout training recipe. Saved arguments are stronger evidence of executed settings than requested options in a resume script.

### Test evidence: keep separate evaluations separate

The earlier V1 [evaluation report](../ai-service/runs/detect/virtual_guard_mall_detector_v1/evaluation_report.json) records 239 test images: precision 0.37251, recall 0.31129, mAP50 0.29281 and mAP50-95 0.12083. Its class AP50 values are bag 0, busket 0.583, people 0.588 and product 0. It records approximately 97.7 ms inference per image on CPU, not full application throughput. The report-generating parser contains hardcoded values, so this historical JSON is not proof of an independently reproduced evaluation.

The later [comparison JSON](../ai-service/runs/evaluation/v1_vs_v2/comparison_report.json) records both detectors on the mall test split. The [comparison script](../ai-service/scripts/compare_mall_detectors_v1_v2.py) specifies image size 640 and batch 16, using CUDA if available and otherwise CPU; the JSON does not record every execution-environment detail.

| Metric | V1 comparison | V2 comparison |
|---|---:|---:|
| Precision | 0.72755 | 0.60033 |
| Recall | 0.27724 | 0.46425 |
| mAP50 | 0.24720 | 0.47549 |
| mAP50-95 | 0.08903 | 0.22354 |

| Class | V1 AP50 | V2 AP50 | V1 AP50-95 | V2 AP50-95 |
|---|---:|---:|---:|---:|
| Bag | 0.04195 | 0.22867 | 0.01668 | 0.07952 |
| Busket | 0.40241 | 0.67354 | 0.13456 | 0.32426 |
| People | 0.51706 | 0.87957 | 0.19115 | 0.42642 |
| Product | 0.02737 | 0.12019 | 0.01374 | 0.06397 |

Different V1 results must not be merged into one benchmark: evaluation settings/provenance differ. There is no saved directly comparable four-class test score for the generic COCO baseline, so none is claimed here.

### Why V2 was rejected but remains configured

The script's minimum acceptance rule requires **all** of: bag AP50 > 0.05, product > 0.05, busket > 0.70 and people > 0.70. V2 fails because **busket AP50 is 0.67354**, below 0.70. This causes the saved `REJECTED` decision despite improvements over V1 in all four class AP50 values.

The target rule additionally requires bag > 0.20, product > 0.15 and overall mAP50 > 0.35. Product AP50 0.12019 fails that target. The excellent rule requires bag > 0.40, product > 0.30 and overall > 0.45; bag and product fail it. The script's label `CANDIDATE FOR PRODUCTION` is only a historical threshold label, not deployment certification.

The application independently selects V2 through configuration; it does not read or enforce the acceptance report. Thus V2 is the configured experimental detector, **not an acceptance-approved promotion**. No evidence establishes a separate approval decision overriding the failed criterion.

## Behaviour classifier

### Model and feature generation

`behaviour_model_v2.pkl` is a 150-tree `RandomForestClassifier`; `scaler_v2.pkl` is its matching `StandardScaler`. Both expect the ordered 14-feature schema in [behaviour.py](../ai-service/app/models/behaviour.py):

| Features | Calculation |
|---|---|
| `avg_motion`, `max_motion`, `min_motion` | Mean, maximum and minimum motion intensity |
| `motion_std`, `motion_median`, `motion_variance`, `motion_range` | Distribution spread and central value |
| `motion_skew`, `motion_kurtosis` | Distribution shape, with short-sequence fallbacks |
| `activity_score` | Mean motion multiplied by processed/total frame ratio |
| `high_motion_ratio`, `low_motion_ratio` | Fraction of motion values above 20 / below 5 |
| `motion_peaks` | Local values exceeding both neighbours by factor 1.5 |
| `motion_trend` | 1 if the second-half mean exceeds the first-half mean, otherwise -1; 0 for fewer than two values |

Every tenth frame is converted to grayscale. Mean absolute pixel difference between successive sampled frames produces a whole-frame motion value. Features are scaled before forest prediction; class 0 maps to `normal`, class 1 to `shoplifting`. Confidence is the maximum predicted-class probability, not measured accuracy or a calibrated probability of theft.

The model **does not use YOLO boxes, track IDs, object interactions or pose features**. The vision branch supports visible evidence; the classifier separately summarizes the recording. Camera shake, illumination changes, ordinary movement and scene differences can influence motion statistics.

The suspicion score adds `50 * confidence` for predicted class 1, plus 20 when average motion > 5, 15 when maximum motion > 15 and 10 when motion standard deviation > 3, capped at 100. It is heuristic and does not determine the classifier's label.

### Recorded evaluation

The September 14 stored-feature evaluation ran [evaluate_behaviour.py](../ai-service/training/evaluate_behaviour.py) against `datasets/features/video_features_improved.csv`. It reconstructs stratified video-identifier splits with random seed 42: 182 identifiers (90 normal, 92 shoplifting), split into 127 training, 27 validation and 28 test identifiers.

| Test metric | Recorded result |
|---|---:|
| Accuracy | 82.14% (23 / 28) |
| Shoplifting precision | 80.00% |
| Shoplifting recall | 85.71% |
| Shoplifting F1 | 82.76% |
| Normal precision / recall / F1 | 0.8462 / 0.7857 / 0.8148 |
| Shoplifting precision / recall / F1 | 0.8000 / 0.8571 / 0.8276 |
| Support | 14 normal, 14 shoplifting |

Confusion matrix (rows actual, columns predicted; order normal, shoplifting): `[[11, 3], [2, 12]]`. That is three false positives and two false negatives on this small evaluation.

The evaluator does not decode original videos or demonstrate that the saved model was trained without these test identifiers. Therefore **82.14% is a recorded stored-feature baseline, not verified independent real-world theft-detection accuracy**. No confidence intervals or representative deployment study are established by this record.

### Reproducibility limits

The checked-in basic behaviour training script produces a four-feature unsuffixed model, not the active 14-feature V2 artifact. The original raw shoplifting-video directory is empty in this checkout. Feature CSVs, supplied classifier/scaler artifacts and schema tests remain useful, but complete V2 retraining provenance is missing. Retaining pose-related data does not mean the behaviour model was trained on poses.

To rerun only the stored-feature evaluation from a configured AI environment:

```powershell
cd ai-service
python -B training/evaluate_behaviour.py
```

Do not use training/resume scripts merely to start the application. Check historical absolute paths and checkpoint availability before a separately authorized reproduction experiment.

## Historical performance observation

Model caching reuses locked YOLO predictors; trackers remain per-video. Pose inference is skipped on sampled frames without detected people because those pose results would otherwise be discarded. The cache holds at most four entries and invalidates on weight-file changes.

The September 27 observation used five alternating runs on ten sampled frames, including model construction. Baseline times were 11.492, 3.020, 2.577, 4.753 and 3.649 seconds; optimized times were 2.406, 2.311, 1.726, 1.591 and 2.003 seconds. Medians were 3.649 and 2.003 seconds (approximately 45% less time). A separate 60-frame comparison recorded identical detections, track IDs, 155 frame-level pose records and decoded annotated frames; 20 regression tests were recorded at that time.

These are preserved historical observations, not a fresh benchmark. Temporary raw benchmark outputs were removed during repository cleanup. CPU warm-up, content, decoding/encoding and host load affect results; no general whole-video speedup or live FPS guarantee follows. Current regression tests cover cache and pose gating behaviour.

## Limitations and human review

- Small or occluded objects remain weak classes, particularly products and bags.
- Dataset imbalance, related scenes and uncertain provenance limit generalization claims.
- The behaviour test set is small and independent holdout status is unverified.
- Both false alarms and missed events occur; model labels cannot establish intent.
- Pose overlays and temporal review suggestions are not validated concealment recognition.
- CPU inference and repeated decoding/encoding can be slow; sampled analysis can miss brief events.
- The system processes uploaded recordings, not continuous CCTV streams.
- Human review remains necessary before operational conclusions or action.
