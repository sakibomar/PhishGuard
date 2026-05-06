"""
evaluate.py — load saved models, compute metrics + SHAP, print report.

Run:
    python -m src.evaluate       (from backend/ directory)
"""

import pickle
import pathlib
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_auc_score, average_precision_score,
    precision_recall_curve, roc_curve,
)

MODELS_DIR = pathlib.Path(__file__).parent.parent / "models"
DATA_DIR   = pathlib.Path(__file__).parent.parent / "data"
PLOTS_DIR  = pathlib.Path(__file__).parent.parent / "plots"

MODEL_NAMES = ["dummy", "lr", "rf", "gbm"]
LABELS      = ["Legitimate", "Phishing"]


def load_test_data():
    X_test = pd.read_csv(DATA_DIR / "X_test.csv")
    y_test = pd.read_csv(DATA_DIR / "y_test.csv").squeeze()
    return X_test, y_test


def load_model(name: str):
    with open(MODELS_DIR / f"{name}.pkl", "rb") as f:
        return pickle.load(f)


def compute_metrics(model, X_test, y_test):
    y_pred  = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]

    cm = confusion_matrix(y_test, y_pred)
    tn, fp, fn, tp = cm.ravel() if cm.size == 4 else (0, 0, 0, 0)

    fpr_val = fp / max(fp + tn, 1)
    roc_auc = roc_auc_score(y_test, y_proba)
    pr_auc  = average_precision_score(y_test, y_proba)

    report = classification_report(y_test, y_pred, target_names=LABELS, output_dict=True)
    return {
        "roc_auc":  round(roc_auc, 4),
        "pr_auc":   round(pr_auc, 4),
        "f1":       round(report["Phishing"]["f1-score"], 4),
        "precision":round(report["Phishing"]["precision"], 4),
        "recall":   round(report["Phishing"]["recall"], 4),
        "fpr":      round(fpr_val, 4),
        "cm":       cm.tolist(),
        "y_proba":  y_proba,
    }


def plot_curves(results, y_test):
    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    colors = {"dummy": "#6b7280", "lr": "#00b4d8", "rf": "#00f0ff", "gbm": "#9b59ff"}

    # ROC curves
    fig, axes = plt.subplots(1, 2, figsize=(14, 5), facecolor="#0d0f1a")
    for ax in axes:
        ax.set_facecolor("#0d0f1a")
        ax.tick_params(colors="white")
        for spine in ax.spines.values():
            spine.set_edgecolor("#333")

    for name, m in results.items():
        fpr, tpr, _ = roc_curve(y_test, m["y_proba"])
        axes[0].plot(fpr, tpr, label=f"{name.upper()} (AUC={m['roc_auc']:.3f})", color=colors[name], lw=2)
    axes[0].plot([0,1],[0,1],"--", color="#444", lw=1)
    axes[0].set_xlabel("FPR", color="white"); axes[0].set_ylabel("TPR", color="white")
    axes[0].set_title("ROC Curves", color="white"); axes[0].legend(facecolor="#1a1c2a", labelcolor="white")

    for name, m in results.items():
        prec, rec, _ = precision_recall_curve(y_test, m["y_proba"])
        axes[1].plot(rec, prec, label=f"{name.upper()} (AP={m['pr_auc']:.3f})", color=colors[name], lw=2)
    axes[1].set_xlabel("Recall", color="white"); axes[1].set_ylabel("Precision", color="white")
    axes[1].set_title("Precision-Recall Curves", color="white"); axes[1].legend(facecolor="#1a1c2a", labelcolor="white")

    plt.tight_layout()
    plt.savefig(PLOTS_DIR / "curves.png", dpi=150, bbox_inches="tight", facecolor="#0d0f1a")
    plt.close()
    print(f"Saved curves → {PLOTS_DIR / 'curves.png'}")


def shap_analysis(X_test, y_test):
    """SHAP analysis for the Random Forest model."""
    try:
        import shap
    except ImportError:
        print("SHAP not installed — skipping. Run: pip install shap")
        return

    print("\nRunning SHAP analysis on Random Forest …")
    rf  = load_model("rf")
    clf = rf.named_steps["clf"]   # unwrap Pipeline → RandomForestClassifier

    explainer   = shap.TreeExplainer(clf)
    shap_values = explainer.shap_values(X_test)

    # shap_values is a list [class0, class1] for RF
    sv = shap_values[1] if isinstance(shap_values, list) else shap_values

    PLOTS_DIR.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(10, 6), facecolor="#0d0f1a")
    shap.summary_plot(sv, X_test, show=False, plot_size=None)
    plt.savefig(PLOTS_DIR / "shap_summary.png", dpi=150, bbox_inches="tight", facecolor="#0d0f1a")
    plt.close()
    print(f"Saved SHAP summary → {PLOTS_DIR / 'shap_summary.png'}")

    # Mean |SHAP| per feature
    mean_abs = np.abs(sv).mean(axis=0)
    feat_imp = dict(zip(X_test.columns, mean_abs.tolist()))
    feat_imp_sorted = dict(sorted(feat_imp.items(), key=lambda x: x[1], reverse=True))

    print("\nTop-10 SHAP feature importances (RF):")
    for i, (feat, val) in enumerate(list(feat_imp_sorted.items())[:10], 1):
        print(f"  {i:2d}. {feat:<35} {val:.4f}")

    return feat_imp_sorted


def evaluate():
    print("Loading test data …")
    X_test, y_test = load_test_data()

    results = {}
    print("\n{'Model':<8} {'ROC-AUC':>8} {'PR-AUC':>8} {'F1':>8} {'Prec':>8} {'Rec':>8} {'FPR':>8}")
    print("-" * 60)
    for name in MODEL_NAMES:
        model = load_model(name)
        m = compute_metrics(model, X_test, y_test)
        results[name] = m
        print(f"{name:<8} {m['roc_auc']:>8.4f} {m['pr_auc']:>8.4f} {m['f1']:>8.4f} "
              f"{m['precision']:>8.4f} {m['recall']:>8.4f} {m['fpr']:>8.4f}")

    plot_curves(results, y_test)
    shap_analysis(X_test, y_test)
    return results


if __name__ == "__main__":
    evaluate()
