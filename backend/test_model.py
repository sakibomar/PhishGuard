"""Test models directly (no API)."""
import sys, pickle, warnings
import numpy as np
import pandas as pd
warnings.filterwarnings("ignore")
sys.path.insert(0, "src")
from features import extract_features, FEATURE_NAMES, features_to_vector

urls = [
    # Clearly phishing
    ("http://paypal-secure-login.tk/verify",       "PHISH"),
    ("http://192.168.1.1/login@bank.com",          "PHISH"),
    ("http://shprakserf.gq",                       "PHISH"),
    ("http://confirm-banking-details.ml/signin",   "PHISH"),
    ("http://service-mitld.firebaseapp.com/",      "PHISH"),
    ("http://kuradox92.lima-city.de",              "PHISH"),
    # Clearly legitimate (matches PhiUSIIL-style domains)
    ("https://www.southbankmosaics.com",           "LEGIT"),
    ("https://www.stackoverflow.com",              "LEGIT"),
    ("https://www.bloomberg.com",                  "LEGIT"),
    ("https://www.tripadvisor.com",                "LEGIT"),
    ("https://www.booking.com",                    "LEGIT"),
    ("https://www.wikipedia.org",                  "LEGIT"),
    # Edge cases — well-known short domains (expected FP area)
    ("https://google.com/search?q=weather",        "LEGIT*"),
    ("https://github.com/openai/gpt-4",            "LEGIT*"),
    ("https://reddit.com/r/programming",           "LEGIT*"),
]

for model_name in ["rf", "gbm"]:
    model = pickle.load(open(f"models/{model_name}.pkl", "rb"))
    correct = 0
    total = 0
    print(f"\n=== {model_name.upper()} ===")
    for url, expected in urls:
        f = extract_features(url)
        vec = np.array(features_to_vector(f)).reshape(1, -1)
        proba = model.predict_proba(vec)[0]
        pred = "PHISH" if proba[1] >= 0.5 else "LEGIT"
        match = "✓" if (pred == expected or expected.endswith("*")) else ("✗" if pred != expected.rstrip("*") else "✓")
        if not expected.endswith("*"):
            total += 1
            if pred == expected:
                correct += 1
        print(f"  {match} [{pred:5s}] p={proba[1]:.3f}  expected={expected:6s}  {url}")
    print(f"  Core accuracy: {correct}/{total}")
