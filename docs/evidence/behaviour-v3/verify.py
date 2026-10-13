"""Read-only, standard-library consistency checks for published saved evidence."""

import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def require(condition, message):
    if not condition:
        raise ValueError(message)


def read_json(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def read_csv(name):
    with (ROOT / name).open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream))


def check_metrics(rows, saved, truth="label"):
    counts = Counter((int(r[truth]), int(r["prediction"])) for r in rows)
    tn, fp, fn, tp = [counts[x] for x in [(0, 0), (0, 1), (1, 0), (1, 1)]]
    require(sum([tn, fp, fn, tp]) == len(rows), "Non-binary labels/predictions")
    expected = saved.get("confusion")
    if expected is None:
        expected = [x for row in saved["confusion_matrix"] for x in row]
    require([tn, fp, fn, tp] == expected, "Confusion matrix mismatch")
    require(len(rows) == saved["n"], "Row-count mismatch")
    metrics = {"accuracy": (tn + tp) / len(rows),
               "precision": tp / (tp + fp) if tp + fp else None,
               "recall": tp / (tp + fn) if tp + fn else None}
    for name, value in metrics.items():
        # The older internal evaluator encodes undefined precision as zero
        # with an explicit flag; recovery uses JSON null instead.
        if (name == "precision" and value is None and
                saved.get("precision_defined") is False and saved[name] == 0):
            continue
        require(value is None and saved[name] is None or
                value is not None and saved[name] is not None and
                math.isclose(value, saved[name], abs_tol=1e-12),
                "Metric mismatch: " + name)
    return [tn, fp, fn, tp]


def main():
    manifest = read_json("manifest.json")
    for item in manifest["files"]:
        path = (ROOT / item["file"]).resolve()
        require(path.is_relative_to(ROOT), "Manifest path escapes evidence directory")
        data = path.read_bytes()
        require(len(data) == item["bytes"], "Size mismatch: " + item["file"])
        require(hashlib.sha256(data).hexdigest() == item["sha256"],
                "Hash mismatch: " + item["file"])
    print("PASS: hashes for", len(manifest["files"]), "evidence files")

    members = read_csv("recovery/source-membership.csv")
    by_id = {r["id"]: r for r in members}
    require(len(by_id) == len(members) == 1078, "Membership must be unique")
    require(Counter(r["role"] for r in members) ==
            {"development": 704, "auxiliary": 182, "locked": 192}, "Cohort sizes")
    development = {r["id"] for r in members if r["role"] == "development"}
    require(len({by_id[x]["group"] for x in development}) == 22, "Development groups")
    rows = read_csv("recovery/outer-predictions.csv")
    results = read_json("recovery/results.json")
    require(set(r["method"] for r in rows) == set(results), "Recovery method set")
    for method, saved in results.items():
        subset = [r for r in rows if r["method"] == method]
        require(len(subset) == len({r["id"] for r in subset}) == 704, method)
        require({r["id"] for r in subset} == development, "Development membership")
        require(all(r["label"] == by_id[r["id"]]["label"] for r in subset), "Labels")
        check_metrics(subset, saved)
    primary = [r for r in rows if r["method"] == "primary_nested"]
    require(all(int(r["prediction"]) == int(float(r["probability"]) >=
                float(r["threshold"])) for r in primary), "Primary threshold rule")
    require(check_metrics(primary, results["primary_nested"]) == [393, 186, 96, 29],
            "Primary published counts")
    print("PASS: all 11 recovery methods; primary TN/FP/FN/TP = 393/186/96/29")

    splits = read_json("recovery/splits.json")
    require(len(splits) == 3, "Outer-fold count")
    for fold in splits:
        train, validation = set(fold["train"]), set(fold["validation"])
        require(train | validation == development, "Outer coverage")
        require({r["id"] for r in primary if int(r["outer"]) == fold["outer"]}
                == validation, "Outer predictions do not match split")
        require(len(fold["inner"]) == 3, "Inner-fold count")
        for split in [fold] + fold["inner"]:
            a, b = set(split["train"]), set(split["validation"])
            require(not a & b, "Row leakage")
            require(not {by_id[x]["group"] for x in a} &
                    {by_id[x]["group"] for x in b}, "Recorded-group leakage")
        for inner in fold["inner"]:
            require(set(inner["train"]) | set(inner["validation"]) == train,
                    "Inner coverage")
    fits = [json.loads(line) for line in
            (ROOT / "recovery/fit-log.jsonl").read_text().splitlines()]
    status = read_json("recovery/status.json")
    require(len(fits) == status["fits"] == 36 and status["status"] == "complete",
            "Completed fits")
    require(status["final_holdout_predictions"] == 0 and
            status["promotion_supported"] is False, "Recovery scope")
    print("PASS: outer/inner recorded-group separation and 36 completed fits")

    internal = read_csv("internal/outer-predictions.csv")
    comparisons = read_json("internal/comparison.json")
    require(set(r["candidate"] for r in internal) == set(comparisons), "Internal methods")
    for candidate, saved in comparisons.items():
        subset = [r for r in internal if r["candidate"] == candidate]
        require(len(subset) == len({r["row"] for r in subset}) == 182, candidate)
        check_metrics(subset, saved, truth="truth")
    check_metrics(read_csv("external/heldout-predictions.csv"),
                  read_json("external/heldout-results.json")["results"]["selected_model"])
    check_metrics(read_csv("external/secondary-transfer-predictions.csv"),
                  read_json("external/secondary-transfer-results.json")["result"])
    print("PASS: all 9 internal candidates and both earlier 192-segment results")

    downloads = read_json("dataset/dcsass-download-manifest.json")
    require(downloads["dataset"] == "mateohervas/dcsass-dataset" and
            downloads["version"] == 1 and len(downloads["files"]) == 896, "Dataset")
    with (ROOT / "dataset/dcsass-shoplifting-labels.csv").open(newline="") as stream:
        labels = list(csv.reader(stream))
    require(len(labels) == len({r[0] for r in labels}) == 896, "Unique segment labels")
    require(Counter(r[2] for r in labels) == {"0": 741, "1": 155}, "Label counts")
    label_map = {r[0] + ".mp4": r[2] for r in labels}
    ds_members = [r for r in members if r["dataset"] == "dcsass"]
    require({r["video_name"] for r in ds_members} == set(label_map), "Dataset membership")
    require(all(label_map[r["video_name"]] == r["label"] for r in ds_members), "Dataset labels")
    media = {Path(r["source_file"]).name: r for r in downloads["files"]}
    require(set(media) == set(label_map), "Download membership")
    require(all(media[r["video_name"]]["sha256"] == r["sha256"] for r in ds_members),
            "Recorded source hashes")
    groups = Counter(r["source_group"] for r in downloads["files"])
    require(len(groups) == 28 and set(groups.values()) == {32}, "Parent groups")
    old_test = read_csv("external/heldout-predictions.csv")
    locked_names = {r["video_name"] for r in members if r["role"] == "locked"}
    require({r["video_name"] for r in old_test} == locked_names, "Locked earlier assessment")
    print("PASS: DCSASS 896-segment membership, 28 parent groups and locked earlier assessment")
    print("Saved-evidence consistency only; no model inference, fitting or file writes.")


if __name__ == "__main__":
    main()
