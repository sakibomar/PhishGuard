"""
api.py — FastAPI server for PhishGuard AI
Endpoints:
  POST /predict          single URL prediction
  POST /predict/batch    batch URL predictions
  GET  /health           health check

Run:
  uvicorn api:app --reload --port 8000    (from backend/ directory)
"""

import pickle
import pathlib
import sys

import numpy as np
try:
    import shap
    _SHAP_AVAILABLE = True
except ImportError:
    shap = None
    _SHAP_AVAILABLE = False
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# ── path setup ──────────────────────────────────────────────────────────────
ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT / "src"))

from features import extract_features, features_to_vector, FEATURE_NAMES  # noqa: E402

MODELS_DIR = ROOT / "models"
MODEL_IDS  = ["dummy", "lr", "rf", "gbm"]

# ── load models at startup ───────────────────────────────────────────────────
_models: dict = {}
_explainers: dict = {}

def _load_models():
    for mid in MODEL_IDS:
        pkl = MODELS_DIR / f"{mid}.pkl"
        if pkl.exists():
            with open(pkl, "rb") as f:
                _models[mid] = pickle.load(f)
            print(f"  Loaded model: {mid}")
        else:
            print(f"  WARNING: model not found: {pkl}  (run python -m src.train first)")

_load_models()

def _get_classifier(model):
    """Extract tree classifier from sklearn Pipeline or return model."""
    if hasattr(model, 'named_steps'):
        for name in ('c', 'clf', 'classifier', 'rf', 'gbm', 'estimator'):
            if name in model.named_steps:
                return model.named_steps[name]
    return model

def _get_scaler(model):
    """Extract scaler from sklearn Pipeline if present."""
    if hasattr(model, 'named_steps'):
        for name in ('s', 'scaler', 'scale', 'standardscaler'):
            if name in model.named_steps:
                return model.named_steps[name]
    return None

def _init_explainers():
    """Initialize SHAP TreeExplainers for tree-based models."""
    if not _SHAP_AVAILABLE:
        return
    for mid in ('rf', 'gbm'):
        if mid in _models:
            try:
                clf = _get_classifier(_models[mid])
                _explainers[mid] = shap.TreeExplainer(clf)
                print(f"  Loaded SHAP explainer: {mid}")
            except Exception as e:
                print(f"  WARNING: could not load SHAP explainer for {mid}: {e}")

_init_explainers()

def _compute_shap_weights(model_id: str, vec) -> Optional[np.ndarray]:
    """Compute real SHAP feature contributions for a single prediction."""
    if not _SHAP_AVAILABLE or model_id not in _explainers:
        return None
    model = _models[model_id]
    scaler = _get_scaler(model)
    vec_scaled = scaler.transform(vec) if scaler else vec
    shap_vals = _explainers[model_id].shap_values(vec_scaled)
    if isinstance(shap_vals, list):
        shap_vals = shap_vals[1]
    arr = np.array(shap_vals)
    if arr.ndim == 3:
        # shape (n_samples, n_features, 2) → class 1 contributions for first sample
        return arr[0, :, 1]
    return arr[0]

# ── FastAPI app ──────────────────────────────────────────────────────────────
app = FastAPI(title="PhishGuard AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── schemas ──────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    url: str
    model: str = "rf"         # dummy | lr | rf | gbm
    threshold: float = 0.5

class BatchPredictRequest(BaseModel):
    urls: List[str]
    model: str = "rf"
    threshold: float = 0.5

class FeatureDetail(BaseModel):
    name: str
    value: float
    weight: float
    description: str

class PredictResponse(BaseModel):
    url: str
    model: str
    is_phishing: bool
    probability: float
    risk_label: str
    features: List[FeatureDetail]
    top5: List[FeatureDetail]
    domain: str
    has_https: bool

class BatchPredictResponse(BaseModel):
    results: List[dict]
    summary: dict

# ── helpers ───────────────────────────────────────────────────────────────────
FEATURE_DISPLAY = {
    "url_length":          "URL Length",
    "domain_length":       "Domain Length",
    "path_length":         "Path Length",
    "has_www":             "WWW Prefix",
    "subdomain_count":     "Subdomain Count",
    "is_ip_domain":        "IP Address Domain",
    "has_at_symbol":       "@ Symbol",
    "dash_count":          "Dash Count",
    "digit_ratio":         "Digit Ratio",
    "domain_entropy":      "Domain Entropy",
    "has_https":           "HTTPS",
    "keyword_count":       "Suspicious Keywords",
    "has_suspicious_tld":  "Suspicious TLD",
    "percent_count":       "URL Encoding (%)",
    "underscore_count":    "Underscore Count",
    "query_length":        "Query String Length",
    "has_tracking_params": "Tracking Parameters",
    "query_entropy":       "Query Entropy",
}

def _feature_weight(name: str, val: float) -> float:
    """Heuristic importance weights matching the JS extractFeatures logic."""
    w = {
        "url_length":         0.20 if val > 100 else 0.12 if val > 75 else 0.03 if val > 50 else -0.05,
        "domain_length":      0.10 if val > 30  else 0.04 if val > 20 else -0.03,
        "path_length":        0.06 if val > 60  else 0.02 if val > 30 else -0.02,
        "has_www":           -0.10 if val else 0.06,
        "subdomain_count":    0.24 if val > 4   else 0.14 if val > 2  else 0.05 if val > 1 else -0.04,
        "is_ip_domain":       0.25 if val else -0.03,
        "has_at_symbol":      0.22 if val else -0.02,
        "dash_count":         0.18 if val > 4   else 0.10 if val > 2  else 0.02 if val > 0 else -0.03,
        "digit_ratio":        0.15 if val > 0.4 else 0.08 if val > 0.2 else 0.02 if val > 0.05 else -0.04,
        "domain_entropy":     0.12 if val > 4.2 else 0.08 if val > 3.8 else 0.01 if val > 3.2 else -0.06,
        "has_https":         -0.08 if val else 0.10,
        "keyword_count":      0.18 if val > 1   else 0.10 if val == 1 else -0.08,
        "has_suspicious_tld": 0.20 if val else -0.05,
        "percent_count":      0.12 if val > 3   else 0.05 if val > 1  else -0.02,
        "underscore_count":   0.06 if val > 2   else -0.01,
        "query_length":       0.04 if val > 80  else 0.01 if val > 30 else -0.03,
        "has_tracking_params":-0.12 if val else 0.0,
        "query_entropy":      0.08 if val > 4.0 else 0.03 if val > 3.0 else -0.02,
    }
    return w.get(name, 0.0)

def _describe(name: str, val: float, feats: dict) -> str:
    if name == "url_length":       return f"{int(val)} chars"
    if name == "domain_length":    return f"{int(val)} chars"
    if name == "path_length":       return f"{int(val)} chars" if val else "No path"
    if name == "has_www":           return "Present" if val else "Missing"
    if name == "subdomain_count":  return f"{int(val)} subdomains"
    if name == "is_ip_domain":     return "IP-based domain" if val else "Named domain"
    if name == "has_at_symbol":    return "Redirects browser" if val else "Not present"
    if name == "dash_count":       return f"{int(val)} hyphens"
    if name == "digit_ratio":      return f"{val*100:.0f}%"
    if name == "domain_entropy":   return f"H={val:.2f} bits"
    if name == "has_https":        return "Encrypted" if val else "No SSL"
    if name == "keyword_count":    return f"{int(val)} found" if val else "None"
    if name == "has_suspicious_tld": return "High-risk TLD" if val else "Standard TLD"
    if name == "percent_count":    return f"{int(val)} encoding sequences"
    if name == "underscore_count": return f"{int(val)} underscores"
    if name == "query_length":     return f"{int(val)} chars" if val else "No query string"
    if name == "has_tracking_params": return "Known tracking params" if val else "No/unknown params"
    if name == "query_entropy":    return f"H={val:.2f} bits" if val else "No query"
    return str(val)

def _predict_url(url: str, model_id: str, threshold: float = 0.5) -> PredictResponse:
    if model_id not in MODEL_IDS:
        raise HTTPException(status_code=400, detail=f"Unknown model: {model_id}")
    if model_id not in _models:
        raise HTTPException(status_code=503, detail=f"Model '{model_id}' not loaded. Run train.py first.")

    feats = extract_features(url)
    if feats is None:
        raise HTTPException(status_code=422, detail="Cannot parse URL")

    vec = np.array(features_to_vector(feats)).reshape(1, -1)
    model = _models[model_id]
    proba = float(model.predict_proba(vec)[0][1])
    is_phishing = proba >= threshold

    risk_label = (
        "Critical"   if proba >= 0.85 else
        "High"       if proba >= 0.65 else
        "Medium"     if proba >= 0.45 else
        "Low"        if proba >= 0.25 else
        "Safe"
    )

    shap_weights = _compute_shap_weights(model_id, vec)
    feature_details = []
    for name in FEATURE_NAMES:
        val = feats[name]
        if shap_weights is not None:
            w = float(shap_weights[FEATURE_NAMES.index(name)])
        else:
            w = _feature_weight(name, val)
        feature_details.append(FeatureDetail(
            name=FEATURE_DISPLAY[name],
            value=float(val),
            weight=round(w, 6),
            description=_describe(name, val, feats),
        ))

    top5 = sorted(feature_details, key=lambda x: abs(x.weight), reverse=True)[:5]

    import urllib.parse as _up
    try:
        parsed = _up.urlparse(url if url.startswith("http") else "https://" + url)
        domain = parsed.hostname or url
    except Exception:
        domain = url

    return PredictResponse(
        url=url,
        model=model_id,
        is_phishing=is_phishing,
        probability=round(proba, 4),
        risk_label=risk_label,
        features=feature_details,
        top5=top5,
        domain=domain,
        has_https=bool(feats.get("has_https", 0)),
    )

# ── routes ────────────────────────────────────────────────────────────────────
@app.get("/threshold-sweep")
def threshold_sweep():
    """Return real FPR/recall/F1/precision across thresholds for RF."""
    X_test = _load_csv_safe("X_test.csv")
    y_test = _load_csv_safe("y_test.csv")
    if X_test is None or y_test is None:
        raise HTTPException(503, "No test data — run train.py first")
    y_true = y_test.values.ravel()
    rf_model = _models.get('rf')
    if rf_model is None:
        raise HTTPException(503, "RF model not loaded")
    y_proba = rf_model.predict_proba(X_test)[:, 1]

    thresholds = np.arange(0.10, 0.95, 0.02).tolist()
    sweep = []
    for t in thresholds:
        y_pred = (y_proba >= t).astype(int)
        cm = confusion_matrix(y_true, y_pred)
        tn, fp, fn, tp = cm.ravel()
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
        rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        f1 = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0.0
        sweep.append({
            "threshold": round(float(t), 2),
            "fpr": round(float(fpr), 4),
            "recall": round(float(rec), 4),
            "precision": round(float(prec), 4),
            "f1": round(float(f1), 4),
            "fp": int(fp),
            "fn": int(fn),
            "tp": int(tp),
            "tn": int(tn),
        })
    return {"sweep": sweep, "model": "rf", "test_size": len(y_true)}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "models_loaded": list(_models.keys()),
        "models_missing": [m for m in MODEL_IDS if m not in _models],
    }

# ── real dataset stats & model metrics ─────────────────────────────────────
import pandas as pd
from sklearn.metrics import (
    accuracy_score, f1_score, roc_auc_score, average_precision_score,
    confusion_matrix, precision_score, recall_score,
)

DATA_DIR = ROOT / "data"

def _load_csv_safe(name):
    p = DATA_DIR / name
    return pd.read_csv(p) if p.exists() else None

@app.get("/stats")
def dataset_stats():
    """Return real dataset statistics for the EDA Dashboard."""
    processed = _load_csv_safe("processed.csv")
    raw = _load_csv_safe("raw_urls.csv")
    if processed is None:
        raise HTTPException(503, "No processed data — run train.py first")

    feature_cols = [c for c in processed.columns if c != "label"]
    phish = processed[processed.label == 1]
    legit = processed[processed.label == 0]

    # Per-feature stats
    feature_stats = {}
    for col in feature_cols:
        all_vals = processed[col]
        _, edges = pd.cut(all_vals, bins=8, retbins=True)
        ph_hist = pd.cut(phish[col], bins=edges).value_counts().sort_index().tolist()
        lg_hist = pd.cut(legit[col], bins=edges).value_counts().sort_index().tolist()
        bin_labels = [f"{edges[i]:.2g}–{edges[i+1]:.2g}" for i in range(len(edges)-1)]
        feature_stats[col] = {
            "phish_mean": round(float(phish[col].mean()), 4),
            "legit_mean": round(float(legit[col].mean()), 4),
            "bins": bin_labels,
            "phishing": ph_hist,
            "legit": lg_hist,
        }

    # Correlation matrix
    corr = processed[feature_cols].corr()

    return {
        "total_samples": len(processed),
        "phishing_count": int((processed.label == 1).sum()),
        "legit_count": int((processed.label == 0).sum()),
        "n_features": len(feature_cols),
        "feature_names": feature_cols,
        "train_size": len(_load_csv_safe("X_train.csv")) if (DATA_DIR / "X_train.csv").exists() else 0,
        "test_size": len(_load_csv_safe("X_test.csv")) if (DATA_DIR / "X_test.csv").exists() else 0,
        "feature_stats": feature_stats,
        "correlation": {
            "features": feature_cols,
            "matrix": corr.round(3).values.tolist(),
        },
    }

@app.get("/model-metrics")
def model_metrics():
    """Return real evaluation metrics for all trained models."""
    X_test = _load_csv_safe("X_test.csv")
    y_test = _load_csv_safe("y_test.csv")
    if X_test is None or y_test is None:
        raise HTTPException(503, "No test data — run train.py first")
    y_true = y_test.values.ravel()

    MODEL_DISPLAY = {
        "dummy": {"name": "Dummy Classifier", "short": "Dummy", "icon": "dice",
                  "desc": "Majority-class baseline. Always predicts legitimate. Sets the performance floor for all real models.",
                  "details": ["Majority class strategy", "No learning", "sklearn DummyClassifier", "Performance floor"]},
        "lr":    {"name": "Logistic Regression", "short": "LR", "icon": "chart",
                  "desc": "Interpretable linear model with L2 regularisation and Platt scaling for calibrated probability outputs.",
                  "details": ["L2 regularisation (C=1.0)", "StandardScaler pipeline", "Probability calibration", "Linear decision boundary"]},
        "rf":    {"name": "Random Forest", "short": "RF", "icon": "tree",
                  "desc": "Ensemble of 300 decision trees. Main improved model with SHAP TreeExplainer.",
                  "details": ["n_estimators=300", "max_depth=None", "SHAP TreeExplainer", "Feature importance ranking"]},
        "gbm":   {"name": "Gradient Boosting", "short": "GBM", "icon": "bolt",
                  "desc": "Sequential boosting ensemble. Competes with RF on accuracy.",
                  "details": ["learning_rate=0.1", "n_estimators=200, max_depth=5", "SHAP TreeExplainer", "Competitive FPR"]},
    }

    all_metrics = {}
    best_model = None
    best_f1 = -1

    for mid, model in _models.items():
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]
        tn, fp, fn, tp = confusion_matrix(y_true, y_pred).ravel()
        fpr_val = fp / (fp + tn) if (fp + tn) > 0 else 0
        f1 = f1_score(y_true, y_pred)

        metrics = {
            "Accuracy": round(accuracy_score(y_true, y_pred), 4),
            "F1": round(f1, 4),
            "ROC-AUC": round(float(roc_auc_score(y_true, y_proba)), 4),
            "PR-AUC": round(float(average_precision_score(y_true, y_proba)), 4),
            "Precision": round(float(precision_score(y_true, y_pred, zero_division=0)), 4),
            "Recall": round(float(recall_score(y_true, y_pred, zero_division=0)), 4),
            "FPR": round(fpr_val, 4),
        }

        if f1 > best_f1 and mid != "dummy":
            best_f1 = f1
            best_model = mid

        info = MODEL_DISPLAY.get(mid, {})
        all_metrics[mid] = {
            **info,
            "metrics": metrics,
            "confMatrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
            "best": False,
        }

    if best_model and best_model in all_metrics:
        all_metrics[best_model]["best"] = True

    return {"models": all_metrics, "test_size": len(y_true)}

@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    return _predict_url(req.url.strip(), req.model, req.threshold)

@app.post("/predict/batch", response_model=BatchPredictResponse)
def predict_batch(req: BatchPredictRequest):
    results = []
    phishing_count = 0
    legitimate_count = 0
    error_count = 0

    for url in req.urls:
        url = url.strip()
        if not url:
            continue
        try:
            r = _predict_url(url, req.model, req.threshold)
            results.append({
                "url":         r.url,
                "is_phishing": r.is_phishing,
                "probability": r.probability,
                "risk_label":  r.risk_label,
                "domain":      r.domain,
            })
            if r.is_phishing:
                phishing_count += 1
            else:
                legitimate_count += 1
        except HTTPException as e:
            results.append({"url": url, "error": e.detail})
            error_count += 1

    return BatchPredictResponse(
        results=results,
        summary={
            "total":      len(results),
            "phishing":   phishing_count,
            "legitimate": legitimate_count,
            "errors":     error_count,
            "avg_score":  round(
                sum(r["probability"] for r in results if "probability" in r)
                / max(len([r for r in results if "probability" in r]), 1),
                4
            ),
        },
    )
