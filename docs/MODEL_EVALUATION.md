# Model evaluation

[Project overview](../README.md) | [Architecture](ARCHITECTURE.md) | [Setup](SETUP.md)

## Evidence and interpretation

The [V3 results document](BEHAVIOUR_V3_RESULTS.md) provides a cohort-by-cohort account and links to the [published evidence bundle](evidence/behaviour-v3/README.md). Its saved predictions, results, logs and memberships can be checked from a Git clone with `python -B docs/evidence/behaviour-v3/verify.py`, without model inference or training.

Implementation and runtime observations below refer to the inspected local workspace and saved container checks. This documentation-only publication does not include unrelated pending implementation changes or certify that GitHub's application code or a newly built container reproduces those local observations. Local diagnostic scripts named below may therefore be absent from a clean clone; the published V3 evidence verifier is self-contained.

This document separates saved training validation, detector comparisons, dataset audits, retrospective behaviour evaluation, development experiments and historical timing observations. No models were run during the 13 October documentation cleanup. These provide different kinds of evidence. Supplied runtime weights, datasets and original results remain unchanged; fitted behaviour candidates were not promoted. The detector completion review (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/DETECTOR_COMPLETION_REVIEW.md`, preserved local snapshot) records commands, hashes, implementation changes and remaining limits.

Evidence paths under `output/` refer to preserved local artifacts, not files promised in a GitHub clone. The older supporting evidence pages are retained in the local submission snapshot where cited. The current evaluation conclusions are recorded here.

Primary evidence is retained under [runs](../ai-service/runs/), with code under [scripts](../ai-service/scripts/) and [training](../ai-service/training/). Historical metadata contains paths from its original workstation. Those paths are provenance, not portable commands. Some historical prose overstates integration or acceptance; the current implementation and numerical evidence take precedence.

## Object detection

### Models and runtime selection

| Artifact in `ai-service/models/` | Role |
|---|---|
| `yolov8n.pt` | Pretrained YOLOv8 nano baseline; COCO classes, not the four-class task |
| `virtual_guard_mall_detector_v1.pt` | Initial custom mall detector |
| `virtual_guard_mall_detector_v2.pt` | Later custom detector, selected by Compose and `.env.example` |
| `yolov8n-pose.pt` | Separate human-keypoint model; not the mall detector |

Native Python and Compose now both default to `v2` when `VISION_MODEL` is absent. The prior native V1 default was inconsistent with Compose; this review aligned the defaults, without changing weights or historical acceptance criteria. `base` and `v1` are explicit alternatives. Native `CUSTOM_MODEL_PATH` overrides selection; missing configured files raise errors rather than silently substituting a detector. Compose does not forward host-specific custom paths.

The `/analyze` route explicitly passes detection confidence **0.25**, overriding the detector/configuration default of 0.5, and defaults to approximately five sampled frames per second. `YOLODetector` now forwards the configured NMS IoU (`IOU_THRESHOLD`, default **0.7**); previously that setting was ignored and Ultralytics' own 0.7 default applied. The application does not pass an explicit image size and retains Ultralytics' 640 default. Saved training image sizes must not be confused with an explicit application inference setting. The validation replay's fixed-confidence 0.5 diagnostic below is not the application's 0.25 operating point.

Installed Ultralytics 8.3.63 uses automatic stride-aligned letterboxing for a single PyTorch prediction image, even when `rect=False` is supplied. A preprocessing-only probe transformed a 360×640 image to **384×640**, not 640×640. The original experiment protocol's square-input description is corrected in the review (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/DETECTOR_COMPLETION_REVIEW.md`, preserved local snapshot); the executed predictions are unchanged.

### Dataset and imbalance

The mall-surveillance dataset uses YOLO labels with four classes: `0 bag`, `1 busket`, `2 people`, `3 product`. The spelling `busket` is preserved for compatibility. The fresh audit confirmed the saved [dataset analysis](../ai-service/runs/data_analysis/mall_detector_v2/dataset_analysis.json) counts:

| Split | Images | Bag instances | Busket | People | Product | Total instances |
|---|---:|---:|---:|---:|---:|---:|
| Train | 1,120 | 534 | 810 | 4,366 | 1,123 | 6,833 |
| Validation | 239 | 95 | 36 | 473 | 216 | 820 |
| Test | 239 | 67 | 64 | 677 | 122 | 930 |

People dominate the training annotations (approximately 64%); bags contribute approximately 8%. Object count alone is insufficient: small bags/products occupy fewer pixels, often appear occluded and provide less localization detail. Increasing training image size from 416 to 640 was part of the V2 experiment. The saved per-class results still show a substantial gap between people and products.

The fresh audit found no structural label errors, missing labels, duplicate boxes, or exact byte/pixel duplicate images. Structural validity does not establish semantic annotation completeness. Filename families cross partitions: `six` has 44 training and 150 test images; `three` has 53 validation and 89 test images. Visual inspection also found matching camera viewpoints across train/validation and train/test, including different filename families. Filenames alone do not establish original recording identities; these partitions do not establish unseen-store performance.

At maximum-side scale 640, 51/95 validation bags and 115/216 products occupy less than 32² pixels. The ordered image/label manifest has SHA-256 `bf8034d01d87120a3228e08766c4c0ff4ec8f12be2a260e99fd471b8dd2a295a`, identical to the earlier audit. Counts, hashes and contact sheets are retained under `output/capstone-completion/detector/audit` and described in the completion review (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/DETECTOR_COMPLETION_REVIEW.md`, preserved local snapshot).

Local `data.yaml` attributes the detector dataset to Roboflow `rahul-son-boro-ftnsh/mall-products`, version 1, and declares CC BY 4.0. The source page was inaccessible during this review, so that attribution is verified from the local export only. This image dataset is separate from the Kaggle behaviour-video source; keep each artifact's attribution and redistribution terms.

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
| Random seed | 0 | 0 |
| Checkpoint's Ultralytics version | 8.4.126 | 8.3.63 |
| Resume | false | saved `last.pt` checkpoint path |

Sources: V1 [args](../ai-service/runs/detect/virtual_guard_mall_detector_v1/args.yaml) and [results](../ai-service/runs/detect/virtual_guard_mall_detector_v1/results.csv); V2 [args](../ai-service/runs/detect/virtual_guard_mall_detector_v2/args.yaml) and [results](../ai-service/runs/detect/virtual_guard_mall_detector_v2/results.csv).

V1's highest recorded validation mAP50-95 occurs at epoch 4: precision 0.84526, recall 0.26718, mAP50 0.29896 and mAP50-95 0.13406. Its checkpoint records zero-based epoch 3 and matching metrics. Recorded Ultralytics 8.4.126 uses mAP50-95 alone for fitness. Only five epochs are recorded; these records do not establish why training stopped, and configured patience 10 is not evidence of early stopping at epoch 5.

**V2's highest recorded checkpoint-selection fitness is at epoch 100.** Its recorded Ultralytics 8.3.63 uses `0.1 × mAP50 + 0.9 × mAP50-95`: precision 0.60948, recall 0.39949, mAP50 0.44605, mAP50-95 0.21573 and fitness 0.238762. The distributed V2 file equals the run's `weights/best.pt` byte for byte, with SHA-256 `e33e5f880e32f4045bfc4aa84d0c9ffc26f6492a5d639f86524824c4f17e4249`. Its embedded training metrics match epoch 100. The checkpoint's epoch field is stripped to -1; the linkage is supported by metrics and hashes rather than an intact epoch field.

Epoch 61 instead has the highest mAP50-95 alone: precision 0.48484, recall 0.42536, mAP50 0.43525 and mAP50-95 0.21596. These validation values are separate from the test results below. An unrelated prose row after the 100 numeric CSV rows was excluded without changing the original file. Version-specific source definitions and checkpoint inspection evidence are linked in the completion review (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/DETECTOR_COMPLETION_REVIEW.md`, preserved local snapshot).

The historical Phase 5 work includes dataset analysis, visual inspection, V2 training/resume and V1/V2 comparison. Preserve [PHASE5_BASELINE_MANIFEST.json](../ai-service/PHASE5_BASELINE_MANIFEST.json) and the original run artifacts as historical provenance. Historical experiment prose must not be taken as proof of integration: the active behaviour classifier is independent of object detections, tracks and poses. `train_mall_detector_v2.py` currently resumes a checkpoint and verifies protected artifacts; it is not a clean-checkout training recipe. Saved arguments are stronger evidence of executed settings than requested options in a resume script.

### Test evidence: keep separate evaluations separate

The earlier V1 [evaluation report](../ai-service/runs/detect/virtual_guard_mall_detector_v1/evaluation_report.json) records 239 test images: precision 0.37251, recall 0.31129, mAP50 0.29281 and mAP50-95 0.12083. Its class AP50 values are bag 0, busket 0.583, people 0.588 and product 0. It records approximately 97.7 ms inference per image on CPU, not full application throughput. The report-generating parser contains hardcoded values, so this historical JSON is not proof of an independently reproduced evaluation.

The later [comparison JSON](../ai-service/runs/evaluation/v1_vs_v2/comparison_report.json) records both detectors on the mall test split. The [comparison script](../ai-service/scripts/compare_mall_detectors_v1_v2.py) specifies image size 640 and batch 16, using CUDA if available and otherwise CPU; the JSON does not record every execution-environment detail.

These are preserved historical values, not a fresh independent test evaluation. In the installed 8.3.63 metric implementation, `results.box.mp` and `mr` average class precision/recall at the confidence point maximising smoothed mean F1. They are not fixed-confidence 0.25 or 0.5 measurements. V2 improves recall and both mAP measures while reducing mean class precision by approximately **12.72 percentage points**.

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

### Complete validation replay and incomplete size experiment

The prespecified input-size experiment used the unchanged V2 checkpoint on the existing 239 validation images, with batch 1, CPU, two Torch threads, confidence floor .001, NMS IoU .7, maximum 300 detections, no augmentation and seed 42. Its 640 predictions were complete. The new local replay script (`ai-service/scripts/replay_detector_validation.py`) verified all image/label hashes, ordered membership, checkpoint identity and saved ground truth, then reproduced the metrics exactly without new inference: **mAP50 0.44669034**, **mAP50-95 0.21686606**. The compact replay result (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/detector_validation_replay.json`, preserved local snapshot) preserves these numbers.

| Class | Annotation support | AP50 | AP50-95 | Precision at .5 | Recall at .5 |
|---|---:|---:|---:|---:|---:|
| Bag | 95 | 0.18017 | 0.07490 | 0.50000 | 0.11579 |
| Busket | 36 | 0.66908 | 0.36970 | 0.81481 | 0.61111 |
| People | 473 | 0.82997 | 0.38999 | 0.89373 | 0.69345 |
| Product | 216 | 0.10755 | 0.03288 | 0.00000 | 0.00000 |

The fixed-.5 columns use IoU .5 and confidence .5. Corresponding TP/FP/FN counts are bag 11/11/84, busket 22/5/14, people 328/39/145, and product 0/2/216. Small-box recall at that same point is 2/51, 1/10, 0/11 and 0/115 respectively; this area-based diagnostic is not COCO AP-small. Validation prediction and historical test-validation paths also differ in preprocessing and class-max versus multi-label NMS. Their scores must not be presented as a before/after comparison.

The **768 run is incomplete: 25/239 images** before a CPU memory-allocation failure. No aggregate 768 score or size improvement is claimed. A later probe recorded only **106.6 MiB available RAM** and no CUDA, so no further detector inference or training was attempted. Runtime remains unchanged at the 640 default. The saved 640 run took 255.08 seconds including scoring/plots and had a 0.44085-second median prediction call; these are historical run timings, not application throughput.

Current replay versions are Python 3.13.3, Torch 2.14.0, Torchvision 0.29.0, NumPy 2.2.6, OpenCV 4.10.0.84 and Ultralytics 8.3.63. Torch/Torchvision differ from the deployment requirements' 2.5.1/0.20.1 pins; these results do not validate that separate environment. The review (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/DETECTOR_COMPLETION_REVIEW.md`, preserved local snapshot) records all nine focused metric/configuration regression checks, primary research sources and remaining grouping limitations.

To verify existing predictions without inference, run from the repository root with a new output directory:

```powershell
& ai-service/venv313/Scripts/python.exe ai-service/scripts/replay_detector_validation.py --output output/detector-replay-check
```

Once sufficient memory is available, the existing bounded comparison can be rerun with the same two prespecified sizes and a new directory:

```powershell
& ai-service/venv313/Scripts/python.exe ai-service/scripts/compare_detector_validation_sizes.py --output output/detector-size-recovery
```

The comparator supports only `--output`; it reruns both 640 and 768 and **does not resume** the partial 768 predictions. It refuses existing output, requires Ultralytics 8.3.63, and retains its ten-minute inference budget. Its original protocol's square-input claim is superseded by the preprocessing correction above. This is a prospective recovery command, not another completed experiment or a wider parameter search.

### Why V2 was rejected but remains configured

The script's minimum acceptance rule requires **all** of: bag AP50 > 0.05, product > 0.05, busket > 0.70 and people > 0.70. V2 fails because **busket AP50 is 0.67354**, below 0.70. This causes the saved `REJECTED` decision despite improvements over V1 in all four class AP50 values.

The target rule additionally requires bag > 0.20, product > 0.15 and overall mAP50 > 0.35. Product AP50 0.12019 fails that target. The excellent rule requires bag > 0.40, product > 0.30 and overall > 0.45; bag and product fail it. The script's label `CANDIDATE FOR PRODUCTION` is only a historical threshold label, not deployment certification.

The application independently selects V2 through configuration; it does not read or enforce the acceptance report. Thus V2 is the configured experimental detector, **not an acceptance-approved promotion**. No evidence establishes a separate approval decision overriding the failed criterion.

## Behaviour classifier: comparable results and limits

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

This section records V1/V2/V3 features, training reconstruction, data availability and deployment using the saved evidence. The table below retains the main numerical comparisons. Accuracy and precision are percentages; precision refers to the positive shoplifting/abnormal label. Confusion counts are TN / FP / FN / TP.

| Model / procedure | Cohort and evaluation | Accuracy | Precision | Confusion counts | Interpretation |
|---|---|---:|---:|---|---|
| Historical fixed V2 | 28 rows from a later 70/15/15 grouping | 82.14 | 80.00 | 11 / 3 / 2 / 12* | Includes 11 original training rows; not a held-out result. |
| Fixed V2 | Reconstructed original 37-row test: 18 normal, 19 positive | 64.86 | 65.00 | 11 / 7 / 6 / 13 | Retrospective; model-selection reuse and source dependence unresolved. |
| V2 duplicate sensitivity | Exclude test duplicate normal-56: 36 rows | 63.89 | 65.00 | 10 / 7 / 6 / 13 | Does not remove unknown scene dependence. |
| Refit original V2 recipe | 182 rows, five duplicate-group outer folds | 56.04 | 56.00 | 46 / 44 / 36 / 56 | Different fitted models; exploratory development comparison. |
| V3 primary nested selection | Same internal 182-row cohort/folds | 71.98 | 68.81 | 56 / 34 / 17 / 75 | Model and threshold selected in inner folds. |
| V3 fixed forest | Same internal 182-row cohort/folds | 76.37 | 75.26 | 66 / 24 / 19 / 73 | Exploratory; exported after inspecting outer outcomes. |
| V3 combined-data ExtraTrees, .35 | Reserved 192 DCSASS segments, six parent IDs | 57.29 | 23.47 | 87 / 75 / 7 / 23 | Public segment assessment; now inspected and unavailable as an untouched future test. |
| V3 frozen MNNIT-only forest, .50 | Same 192 DCSASS segments | 59.90 | 13.85 | 106 / 56 / 21 / 9 | Secondary transfer diagnostic; not V2. |
| Frozen V2, .50 | Latest 704 converted DCSASS development segments, 22 parent IDs | 58.10 | 18.05 | 361 / 218 / 77 / 48 | Previously inspected development data, not independent retail testing. |
| Latest V3 primary nested selection | Same 704-segment development cohort | 59.94 | 13.49 | 393 / 186 / 96 / 29 | No promotion; no new final assessment. |

*The historical 28-row matrix is reconstructed from the reported metrics and 14/14 support; it is not a newly generated prediction result.

The 37-row V2 result has 68.42% recall and 66.67% F1. Its precision is 13 correct positive predictions out of 20, with a saved descriptive Wilson 95% interval of 43.29-81.88%. This does not establish the proposed 75% precision target. The duplicate normal-55/normal-56 crosses training/test; normal-56 is a true negative, not one of the 13 errors.

Sources: retrospective counts (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/behaviour/retrospective.json`, preserved local snapshot), split membership (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/behaviour/split-membership.csv`, preserved local snapshot), all 14-feature candidates (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/behaviour/comparison.json`, preserved local snapshot), dated V3 internal/external results (`output/capstone-v3/package-verification/virtual-guard-v1/docs/BEHAVIOUR_V3_RESULTS.md`, preserved local snapshot), and latest recovery comparison (`output/v3-recovery-20261013/decision-01/comparison.csv`, local evidence). The latter includes every completed candidate and baseline, not just the primary row above.

The retained 14-feature development comparison figure (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/behaviour/comparison.png`, preserved local snapshot) visualizes the earlier candidate experiment; it does not represent the latest V3 comparison or independent retail testing.

The latest cohort is 579 normal/125 positive segments, so always-normal accuracy is 82.24% with zero recall and undefined positive precision. Accuracy alone is insufficient. The 886 preparation inputs combine those 704 segments with 182 auxiliary MNNIT-derived clips; they are not 886 independent recordings. There were no new predictions on the previously inspected 192-segment DCSASS assessment.

### Completed V3 recovery and dataset provenance

The original four-feature V1 training script and artifacts are distinct from the active 14-feature V2 classifier. The V2 reconstruction reproduces the saved scaler and forest numerically; the later V3 work uses a separate spatiotemporal feature schema and remains offline research. Missing original recording/session identities still limit claims about independence.

The completed recovery used 704 converted DCSASS development segments from 22 recorded parent-video groups (579 normal, 125 positive). Its primary nested candidate-selection procedure produced TN=393, FP=186, FN=96 and TP=29: accuracy 59.94%, precision 13.49% and recall 23.20%. Segment-only Random Forests were selected for outer folds 1 and 2, and the mixed-data Random Forest for fold 3; all selected thresholds were 0.35. This is a fold-specific procedure, not the performance of a single exported model at 0.50.

Three preparation attempts under `output/v3-promotion-20261013/` stopped before candidate fitting: the first two at 791/886 inputs following conversion timeouts, and the third at 880/886 after reaching its preparation budget. The subsequent `output/v3-recovery-20261013/` run reused 880 conversions, completed six missing inputs and ultimately completed 36 fits in `comparison-02/`. Its first comparison attempt stopped before fitting on a configuration-logging error. The incomplete attempts preceded the successful recovery; they do not mean that the completed experiment never occurred.

Saved evidence includes `prepared-01/source-membership.csv`, `prepared-01/splits.json`, `comparison-02/outer-predictions.csv`, `comparison-02/fit-log.jsonl`, `comparison-02/results.json` and `comparison-02/status.json` under the recovery directory. `decision-01/DECISION.md` records the commands and decision. The primary prediction IDs exactly match development membership; recorded source groups do not cross any outer or inner training/validation partition. This verifies the recorded grouping, not independence between unknown cameras, stores or sessions. No new predictions were made on the previously inspected 192-segment assessment, and no replacement model was exported or promoted.

The acquired dataset was the **canonical Shoplifting subset of DCSASS Dataset, version 1**, downloaded on 11 October 2026: 896 segments, 28 recorded parent groups with 32 segments each, and 741 normal / 155 abnormal labels. The 704 development segments and 192 previously assessed segments account for all 896. The 886 preparation inputs instead combine the 704 development segments with 182 auxiliary MNNIT-derived recordings.

The download manifest at `output/behaviour-v3/research/dcsass-download-manifest.json` records versioned Kaggle URLs and file hashes. All 896 local clip hashes matched that manifest during the saved-evidence audit. The adjacent selection record, publisher metadata and label CSV establish the direct DCSASS source. The publisher documents derivation from UCF-Crime; this was not a direct download of the full original UCF-Crime release. Parent-group IDs do not establish independent recording sessions. Original-source byte correspondence, precise segment boundaries and independent label correctness remain unverified. The publisher's labels mean normal/abnormal, not independently confirmed theft.

Cite the acquired data as: Hervas, M. (2019). *DCSASS Dataset* (Version 1) [Data set]. [Kaggle](https://www.kaggle.com/datasets/mateohervas/dcsass-dataset). For its documented ancestry, also cite Sultani, W., Chen, C., & Shah, M. (2018). *Real-world anomaly detection in surveillance videos*. CVPR, 6479-6488. [Official paper](https://openaccess.thecvf.com/content_cvpr_2018/html/Sultani_Real-World_Anomaly_Detection_CVPR_2018_paper.html).

### Interpretation and application parity

The live application retains V2. Its model/scaler bytes match the protected pair, while the inspected container's behaviour code predates some workspace validation changes. The core motion formulas and column order agree. See the saved runtime check (`output/v3-recovery-20261013/runtime-recheck.json`, local evidence) and the input limitations below.

Uploads normally undergo browser conversion before analysis. The saved conversion comparison (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/workflow/upload-conversion-verification.json`, preserved local snapshot) shows changed pixel-derived features and probabilities on two previously inspected clips. Raw-feature results do not measure the complete upload-to-inference path. Missing source/session identities, staged laboratory data, limited motion features and uncertain action labels are separate limitations; no single cause of poor performance has been established.

The reconstruction audit (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/behaviour/reconstruction.json`, preserved local snapshot) reproduces the original V2 scaler and forest numerically. Methodology review (`output/capstone-v3/package-verification/virtual-guard-v1/docs/evidence/behaviour/methodology-review.json`, preserved local snapshot) verifies saved fold membership and metric arithmetic. These are existing records, not experiments rerun during this cleanup. The original proposal's 75% precision target and later V3 accuracy/recall/flag-rate criteria must not be conflated.

## Historical performance observation

Model caching reuses locked YOLO predictors; trackers remain per-video. Pose inference is skipped on sampled frames without detected people because those pose results would otherwise be discarded. The cache holds at most four entries and invalidates on weight-file changes.

The September 27 observation used five alternating runs on ten sampled frames, including model construction. Baseline times were 11.492, 3.020, 2.577, 4.753 and 3.649 seconds; optimized times were 2.406, 2.311, 1.726, 1.591 and 2.003 seconds. Medians were 3.649 and 2.003 seconds (approximately 45% less time). A separate 60-frame comparison recorded identical detections, track IDs, 155 frame-level pose records and decoded annotated frames; 20 regression tests were recorded at that time.

These are preserved historical observations, not a fresh benchmark. The earlier documentation states that temporary raw benchmark outputs were removed in a prior cleanup; they were unavailable for this review. CPU warm-up, content, decoding/encoding and host load affect results; no general whole-video speedup or live FPS guarantee follows. Current regression tests cover cache and pose gating behaviour.

## Limitations and human review

- Small or occluded objects remain weak classes, particularly products and bags.
- Dataset imbalance, related scenes and uncertain provenance limit generalization claims.
- The original 37-record V2 partition is small and reused. The earlier DCSASS assessment has only six parent-video groups and is now inspected; the latest 22-group cohort is development data. Neither establishes independent retail performance.
- Both false alarms and missed events occur; model labels cannot establish intent.
- Pose overlays and temporal review suggestions are not validated concealment recognition.
- CPU inference and repeated decoding/encoding can be slow; sampled analysis can miss brief events.
- The system processes uploaded recordings, not continuous CCTV streams.
- Human review remains necessary before operational conclusions or action.
