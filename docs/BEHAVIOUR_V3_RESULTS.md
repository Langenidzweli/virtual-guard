# V3 behaviour experiments: results and evidence

[Project overview](../README.md) | [Model evaluation](MODEL_EVALUATION.md) | [Evidence files](evidence/behaviour-v3/README.md)

Evidence reviewed on **13 October 2026**. V3 remains offline research. The inspected application retains V2; no V3 replacement was promoted. This documentation publication adds saved evidence, not a model release or a new evaluation.

## Executive finding

The **704-segment experiment completed**: its saved primary predictions reproduce **59.94% accuracy, 13.49% precision and 23.20% recall**. Earlier attempts stopped before fitting; a subsequent recovery completed preparation and **36 model fits**. These are successive execution attempts in the same investigation, not contradictory reports or independent replications.

The promising internal V3 forest result on 182 previously inspected recordings did not establish transfer to DCSASS segments. None of these experiments establishes the proposed **75% shoplifting precision on independent retail footage**. Recorded parent-video groups are the available grouping unit; independent cameras, stores and sessions are not established.

## Keep the three experimental cohorts separate

Percentages below describe the positive label. Confusion counts are **TN / FP / FN / TP**. Internal positives use the supplied shoplifting label; DCSASS positives use its published abnormal label within the Shoplifting category.

| Experiment / procedure | Cohort | Accuracy | Precision | Recall | Confusion counts | Interpretation |
|---|---|---:|---:|---:|---|---|
| Internal V3 primary nested selection | 182 recordings; five outer folds | 71.98% | 68.81% | 81.52% | 56 / 34 / 17 / 75 | Exploratory development; unknown scene/session dependence |
| Internal V3 fixed random forest, .50 | Same 182 recordings/folds | 76.37% | 75.26% | 79.35% | 66 / 24 / 19 / 73 | Exported after inspecting outer results; no independent performance claim |
| Combined-data ExtraTrees, .35 | 192 DCSASS segments; six reserved parent groups | 57.29% | 23.47% | 76.67% | 87 / 75 / 7 / 23 | Earlier source-group assessment; now consumed |
| Frozen internal V3 forest, .50 | Same 192 segments | 59.90% | 13.85% | 30.00% | 106 / 56 / 21 / 9 | Secondary transfer diagnostic |
| Recovery primary nested selection | 704 DCSASS development segments; 22 parent groups | 59.94% | 13.49% | 23.20% | 393 / 186 / 96 / 29 | Completed development comparison; no promotion |

The 182-record internal experiment uses duplicate grouping, not known recording-session grouping. Its status records 126 fits. Its candidates and probabilities remain available in [internal predictions](evidence/behaviour-v3/internal/outer-predictions.csv) and [results](evidence/behaviour-v3/internal/comparison.json). The earlier assessment is supported by [primary predictions](evidence/behaviour-v3/external/heldout-predictions.csv), [primary results](evidence/behaviour-v3/external/heldout-results.json), [secondary predictions](evidence/behaviour-v3/external/secondary-transfer-predictions.csv) and [secondary results](evidence/behaviour-v3/external/secondary-transfer-results.json).

These cohorts, units, fitted models and selection procedures differ. The table is not a controlled before/after deployment comparison. A source-group split within DCSASS is not proof of unseen-store or independent real-world retail performance.

## Completed 704-segment recovery

The [membership file](evidence/behaviour-v3/recovery/source-membership.csv) records 704 development segments (579 normal, 125 positive), 182 auxiliary recordings and 192 locked segments. **886 preparation inputs = 704 development segments + 182 auxiliary recordings**. It does not mean 886 DCSASS videos or 886 independent original recordings.

Preparation reused 880 completed conversions and completed six missing inputs. The earlier assessment's 192 segments remained locked against new prediction in this recovery. All 704 primary prediction IDs match development membership; none belongs to the locked cohort.

The protocol uses three outer and three inner stratified group folds, shuffle enabled and seed 42. The [saved splits](evidence/behaviour-v3/recovery/splits.json) keep recorded groups separate between training and validation. Candidates are a mixed-data random forest, a segment-only forest and a relative-motion forest. The mixed candidate adds eligible auxiliary recordings only to training. The original representation has 173 motion features; the relative variant has 172.

The forests use 150 trees, maximum depth 8, minimum leaf 3, minimum split 6, balanced class weights, seed 42 and one worker. Zero imputation and StandardScaler are fitted within training folds. The threshold search is .35/.50/.65/.80. Inner selection first considers the accuracy/precision targets with recall and alert-rate safeguards, then falls back as recorded. All primary selections were marked `diagnostic_only`.

| Outer fold | Validation segments | Selected candidate | Threshold |
|---|---:|---|---:|
| 1 | 224 | Segment-only random forest | 0.35 |
| 2 | 256 | Segment-only random forest | 0.35 |
| 3 | 224 | Mixed-data random forest | 0.35 |

See [resolved configurations](evidence/behaviour-v3/recovery/candidate-configurations.json), [inner selections](evidence/behaviour-v3/recovery/inner-selections.json), [fit log](evidence/behaviour-v3/recovery/fit-log.jsonl) and [completion status](evidence/behaviour-v3/recovery/status.json). The fit log contains 36 fits. No single all-data replacement model was exported from this recovery.

Filtering [outer predictions](evidence/behaviour-v3/recovery/outer-predictions.csv) to `method=primary_nested` gives:

| Actual / predicted | Normal | Positive |
|---|---:|---:|
| Normal | TN = 393 | FP = 186 |
| Positive | FN = 96 | TP = 29 |

- Accuracy = (393 + 29) / 704 = **59.94%**.
- Positive precision = 29 / (29 + 186) = **13.49%**.
- Positive recall = 29 / 125 = **23.20%**.
- Alerts = 215 / 704 = **30.54%**.

The saved 95% source-group bootstrap intervals are accuracy 52.13-67.61%, precision 5.73-23.88% and recall 11.80-34.44%. They use 2,000 replicates and seed 42, condition on saved out-of-fold predictions, and omit training uncertainty and unknown shared-camera dependence. The verifier recounts point metrics; it does not rerun the bootstrap.

### All completed recovery comparisons

All methods below have 704 saved predictions on the same development cohort. Results and intervals for every method are retained in [results.json](evidence/behaviour-v3/recovery/results.json).

| Method | Accuracy | Precision | Recall | TN / FP / FN / TP |
|---|---:|---:|---:|---|
| Mixed forest, fixed .50 | 75.00% | 1.89% | 0.80% | 527 / 52 / 124 / 1 |
| Segment-only forest, fixed .50 | 77.98% | 5.88% | 1.60% | 547 / 32 / 123 / 2 |
| Relative-motion forest, fixed .50 | 79.12% | 7.69% | 1.60% | 555 / 24 / 123 / 2 |
| Mixed forest, inner-selected threshold | 60.80% | 12.44% | 20.00% | 403 / 176 / 100 / 25 |
| Segment-only forest, inner-selected threshold | 63.07% | 14.29% | 21.60% | 417 / 162 / 98 / 27 |
| Relative-motion forest, inner-selected threshold | 64.49% | 13.45% | 18.40% | 431 / 148 / 102 / 23 |
| Primary nested candidate/threshold selection | 59.94% | 13.49% | 23.20% | 393 / 186 / 96 / 29 |
| Frozen V2 reference | 58.10% | 18.05% | 38.40% | 361 / 218 / 77 / 48 |
| Frozen V3 forest, .50 | 63.64% | 23.05% | 44.80% | 392 / 187 / 69 / 56 |
| Always normal | 82.24% | Undefined | 0.00% | 579 / 0 / 125 / 0 |
| Always positive | 17.76% | 17.76% | 100.00% | 0 / 579 / 0 / 125 |

Accuracy alone is misleading on this imbalanced cohort. Always normal exceeds 80% accuracy while missing every positive. Frozen V2 uses the saved classifier's prediction rule; the CSV's .50 annotation is not evidence of threshold tuning. These reference rows are diagnostics, not fresh independent tests.

## Interrupted attempts preceded the completed recovery

Times below are **South Africa Standard Time (UTC+02:00)** on 13 October 2026. The [failure summary](evidence/behaviour-v3/recovery/interrupted-attempts.json) retains original UTC timestamps and source-file hashes through the manifest.

| Attempt, relative to local `output/` | Outcome | Failure time |
|---|---|---|
| `v3-promotion-20261013/prepared-01` | 791/886 inputs; `normal-89.mp4` exceeded its 90-second conversion timeout | 14:14:11 |
| `v3-promotion-20261013/prepared-02` | 791/886 inputs; same timeout | 17:50:32 |
| `v3-promotion-20261013/prepared-03` | 880/886 inputs; preparation budget reached | 18:22:56 |
| `v3-recovery-20261013/comparison-01` | JSON logging of NaN failed before fitting | 18:53:44 |
| `v3-recovery-20261013/comparison-02` | Subsequently completed all 36 fits and saved results | Completed |

The original decisions remain at `output/v3-promotion-20261013/decision-01/DECISION.md` and `output/v3-recovery-20261013/decision-01/DECISION.md`. Their hashes and exact historical preparation/fitting commands are published in [commands.json](evidence/behaviour-v3/recovery/commands.json). These commands depend on local research code and data omitted from this evidence bundle; they are provenance, not clean-clone execution instructions.

Preparation included frozen-reference inference calculations. Therefore, “stopped before new candidate fits” is accurate; “no inference ever occurred” is not. An incomplete attempt does not negate a later completed experiment.

## Dataset identity, citations and limitations

The direct source was **DCSASS Dataset, version 1, canonical Shoplifting subset**, retrieved from Kaggle on 11 October 2026. The [download manifest](evidence/behaviour-v3/dataset/dcsass-download-manifest.json) records 896 files, zero download errors, per-file versioned URLs and hashes. The [selection record](evidence/behaviour-v3/dataset/dcsass-shoplifting-selection.json) documents selection from the canonical `DCSASS Dataset/Shoplifting/` tree, excluding its lowercase duplicate tree.

The [publisher metadata](evidence/behaviour-v3/dataset/publisher-metadata.json) documents derivation from Sultani, Chen and Shah's UCF-Crime dataset. This supports the derivative attribution independently of filenames. It does not mean the project acquired the original full UCF-Crime release.

The [published segment labels](evidence/behaviour-v3/dataset/dcsass-shoplifting-labels.csv) contain **741 normal and 155 abnormal** entries. There are **28 recorded parent groups, each with 32 segments**: 22 development groups and six previously assessed groups. A Shoplifting category name is not itself a positive segment label. All 896 local media hashes matched the saved download manifest during the preceding audit; videos are not redistributed here, so the portable verifier cannot repeat that media-byte check.

Use both citations, identifying the acquired derivative first:

1. Hervas, M. (2019). *DCSASS Dataset* (Version 1) [Data set]. Kaggle. [Dataset and publisher description](https://www.kaggle.com/datasets/mateohervas/dcsass-dataset). Saved license: CC BY-NC-SA 4.0. The included labels and publisher metadata retain that source attribution; they are not relicensed under the repository's source-code MIT license.
2. Sultani, W., Chen, C., & Shah, M. (2018). *Real-world anomaly detection in surveillance videos*. CVPR, 6479-6488. [Official paper](https://openaccess.thecvf.com/content_cvpr_2018/html/Sultani_Real-World_Anomaly_Detection_CVPR_2018_paper.html).

Unverified: original UCF media-byte lineage, precise segment boundaries, independent camera/store/session identities, and independent correctness of the action labels. No additional independently labelled retail recordings were available. All 28 acquired parent groups have been used for development or assessment; a new random split of these clips would not create an untouched final test.

## Verify the saved evidence without running a model

From the repository root, with Python 3 installed:

```powershell
python -B docs/evidence/behaviour-v3/verify.py
```

The standard-library verifier reads only the checked-in evidence. It verifies hashes, recalculates all published candidate point metrics, checks membership and recorded group separation, and checks completed fit counts. It does not load a model, create predictions, fit anything, decode video, install dependencies or write output files.

See the [evidence index](evidence/behaviour-v3/README.md) for publication boundaries. SHA-256 checks establish integrity relative to the manifest, not an independent attestation of experiment execution. Original features, fitted models, raw media and full runtime environments remain local.
