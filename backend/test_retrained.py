import sys, pickle, pandas as pd
sys.path.insert(0, 'src')
from features import extract_features, FEATURE_NAMES

rf = pickle.load(open('models/rf.pkl', 'rb'))
gbm = pickle.load(open('models/gbm.pkl', 'rb'))
lr = pickle.load(open('models/lr.pkl', 'rb'))

test_urls = [
    # Should be LEGITIMATE
    ("https://drive.google.com/drive/my-drive", "LEGIT"),
    ("https://www.pokemon.com/uk", "LEGIT"),
    ("https://arifureta.fandom.com/wiki/Kouki_Amanogawa", "LEGIT"),
    ("https://www.pokemoncenter.com/en-gb?srsltid=AfmBOooM7ubH1", "LEGIT"),
    ("https://www.google.com", "LEGIT"),
    ("https://www.bbc.co.uk", "LEGIT"),
    ("https://www.stackoverflow.com", "LEGIT"),
    ("https://www.wikipedia.org", "LEGIT"),
    ("https://tasklet.ai/agents/test", "LEGIT"),
    ("https://signin.microsoftonline.com/oauth2", "LEGIT"),
    ("https://accounts.google.com/signin", "LEGIT"),
    # Should be PHISHING
    ("http://paypal-secure-login.tk/verify", "PHISH"),
    ("http://amazon.com@phishing.ml/login", "PHISH"),
    ("http://185.220.101.45/banking/signin", "PHISH"),
    ("http://secure-login-verify-account.xyz", "PHISH"),
    ("http://paypal%2Ecom%2Flogin%2Fverify", "PHISH"),
    ("http://www.paypa1.com/signin", "PHISH"),
]

print(f"Features: {len(FEATURE_NAMES)} → {FEATURE_NAMES}")
print(f"\n{'Expected':8s} {'RF':6s} {'GBM':6s} {'LR':6s} URL")
print("-" * 90)
for url, expected in test_urls:
    f = extract_features(url)
    vec = pd.DataFrame([f], columns=FEATURE_NAMES)
    rf_p = rf.predict_proba(vec)[0][1]
    gbm_p = gbm.predict_proba(vec)[0][1]
    lr_p = lr.predict_proba(vec)[0][1]
    flag = "✗" if (expected == "LEGIT" and rf_p >= 0.5) or (expected == "PHISH" and rf_p < 0.5) else "✓"
    print(f"{expected:8s} {rf_p:.3f}  {gbm_p:.3f}  {lr_p:.3f}  {flag} {url[:60]}")
