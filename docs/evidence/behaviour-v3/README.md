# Published V3 evidence

[Results and interpretation](../../BEHAVIOUR_V3_RESULTS.md) | [Model evaluation](../../MODEL_EVALUATION.md)

This bundle publishes existing experiment records. No new predictions, features or model fits were produced for publication. Runtime observations describe the inspected local environment; this documentation-only commit does not publish unrelated pending application changes or certify a newly deployed container.

| Directory | Evidence |
|---|---|
| `internal/` | Earlier 182-record candidate predictions, results, splits, status and fit times |
| `external/` | Earlier 192-segment primary/secondary predictions and results, plus 896-segment source membership |
| `recovery/` | Completed 704-segment comparison, inner/outer predictions, 36-fit log, fold membership, configurations, status, failure summaries and historical commands |
| `dataset/` | DCSASS versioned download/selection records, published labels, label audit and selected publisher metadata |

[manifest.json](manifest.json) records each evidence file's SHA-256, original local source path/hash and any transformation. Most files are byte-for-byte copies. Recovery membership omits its absolute workstation path column; one historical artifact path is replaced with `<workspace>`. Publisher metadata and preparation/failure/command summaries are explicitly labelled extracts. Numeric prediction values are unchanged.

The local `.gitattributes` preserves CSV/JSON/JSONL bytes across Windows and Linux checkouts so Git line-ending conversion cannot invalidate the manifest hashes.

Source paths under `output/` describe the local provenance and are not required for the portable check. Files called `heldout` retain their historical filenames: that cohort has now been inspected and is not an untouched future test. Likewise, historical fields called `source_videos` or `original_sources` mean recorded parent groups; camera/session independence is unverified.

The older internal evaluator stores undefined always-normal precision as `0.0` with `precision_defined=false`; recovery stores it as JSON `null`. The verifier respects these different encodings. Undefined positive precision is not evidence of a measured zero-precision alert stream.

Run `python -B docs/evidence/behaviour-v3/verify.py` from the repository root. The verifier prints checks to the terminal and writes no files. It does not independently validate labels, raw media hashes, original execution history, confidence intervals or environment parity. Its successful result is an evidence-consistency check, not model validation.

Videos, model weights, private configuration, credentials, runtime uploads and raw logs are not part of this bundle. DCSASS labels and publisher material retain their source attribution and CC BY-NC-SA 4.0 terms; see the [dataset citation](../../BEHAVIOUR_V3_RESULTS.md#dataset-identity-citations-and-limitations). The repository's MIT source-code license does not replace third-party dataset terms.
