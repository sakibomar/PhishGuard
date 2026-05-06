"""
train.py — download REAL secondary dataset, extract URL features, train 4 models.

Primary dataset : PhiUSIIL Phishing URL Dataset (UCI ML Repository, ID 967)
                  235 795 labelled URLs — real phishing + legitimate samples.
                  DOI: 10.24432/C5BS7Q
                  Downloaded via the ucimlrepo Python package.

If UCI download fails, falls back to a local CSV at data/raw_urls.csv
(user can drop any CSV with 'url' and 'label' columns there).

Run:
    python -m src.train          (from backend/ directory)
"""

import pickle
import pathlib
import random
import numpy as np
import pandas as pd
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

MODELS_DIR = pathlib.Path(__file__).parent.parent / "models"
DATA_DIR   = pathlib.Path(__file__).parent.parent / "data"

# ─── dataset loading ──────────────────────────────────────────────────────────

def load_phiusiil():
    """Download PhiUSIIL Phishing URL Dataset (235 795 rows) from UCI via ucimlrepo."""
    # Try ucimlrepo API first
    try:
        from ucimlrepo import fetch_ucirepo
        print("Downloading PhiUSIIL Phishing URL Dataset from UCI ML Repository (id=967) …")
        ds = fetch_ucirepo(id=967)

        urls    = ds.data.features["URL"].astype(str)
        raw_lbl = ds.data.targets["label"].astype(int)
        # PhiUSIIL encoding: 1 = legitimate, 0 = phishing
        # Our encoding:      1 = phishing,   0 = legitimate  → flip
        labels  = (1 - raw_lbl)

        df = pd.DataFrame({"url": urls.values, "label": labels.values})
        df = df.dropna().reset_index(drop=True)
        print(f"  ✓ Downloaded {len(df)} real labelled URLs.")
        return df
    except Exception as e:
        print(f"  UCI API failed: {e}")

    # Fallback: direct download from UCI archive
    try:
        import urllib.request, zipfile, io
        print("  Trying direct download from UCI archive …")
        archive_url = "https://archive.ics.uci.edu/static/public/967/phiusiil+phishing+url+dataset.zip"
        resp = urllib.request.urlopen(archive_url, timeout=60)
        zf = zipfile.ZipFile(io.BytesIO(resp.read()))
        csv_name = [n for n in zf.namelist() if n.endswith(".csv")][0]
        raw = pd.read_csv(zf.open(csv_name))
        urls = raw["URL"].astype(str)
        raw_lbl = raw["label"].astype(int)
        labels = (1 - raw_lbl)
        df = pd.DataFrame({"url": urls.values, "label": labels.values})
        df = df.dropna().reset_index(drop=True)
        print(f"  ✓ Downloaded {len(df)} rows via direct archive.")
        return df
    except Exception as e2:
        print(f"  Direct download also failed: {e2}")
        return None


def debias_legit_urls(df: pd.DataFrame) -> pd.DataFrame:
    """
    PhiUSIIL dataset bias fix:
      ALL 134 850 legitimate URLs have www. prefix AND https.
      This causes the model to learn www + https = legit as a shortcut.

    Fix: for the legitimate class, randomly strip www. from 50% of URLs
    and convert 25% from https to http. This breaks the perfect correlation
    while keeping the real phishing/legitimate URL content intact.
    """
    legit_mask = df["label"] == 0
    legit_urls = df.loc[legit_mask, "url"]

    rng = np.random.RandomState(SEED)
    legit_idx  = df.index[legit_mask]

    # Detect if www/https already debiased
    www_ratio = legit_urls.str.contains("://www\\.").mean()
    if www_ratio >= 0.95:
        # Strip www. from 50% of legit URLs
        strip_www = rng.choice(legit_idx, size=int(len(legit_idx) * 0.50), replace=False)
        df.loc[strip_www, "url"] = df.loc[strip_www, "url"].str.replace("://www.", "://", n=1)

        # Convert 25% of legit to http
        to_http = rng.choice(legit_idx, size=int(len(legit_idx) * 0.25), replace=False)
        df.loc[to_http, "url"] = df.loc[to_http, "url"].str.replace("https://", "http://", n=1)
        print(f"  ✓ Applied www/https debiasing")
    else:
        print(f"  ⚠ www/https already debiased (www ratio={www_ratio:.2f}), skipping that step")

    # Detect if path injection already done
    path_ratio = df.loc[legit_mask, "url"].apply(lambda u: len(u.split('/')) > 3).mean()
    if path_ratio >= 0.20:
        print(f"  ⚠ Paths already injected (path ratio={path_ratio:.2f}), skipping path/query/sub injection")
        return df

    # ── AGGRESSIVE PATH INJECTION (85% of legit URLs) ────────────────────
    # PhiUSIIL legit URLs are ALL bare domains (0% have paths).
    # Real-world legit URLs almost always have paths, queries, subdomains.
    # We must inject these into the MAJORITY of legit URLs so the model
    # cannot learn "any path = phishing" as a shortcut.
    LEGIT_PATHS = [
        # Basic navigation
        "/about", "/contact", "/products", "/services", "/blog",
        "/news", "/help", "/faq", "/home", "/index.html",
        "/search", "/terms", "/privacy", "/careers", "/team",
        # Authentication (critical — legit sites have these too!)
        "/login", "/signin", "/sign-in", "/account", "/register",
        "/auth/callback", "/oauth2/authorize", "/sso/saml/login",
        "/password/reset", "/verify", "/confirm", "/2fa/setup",
        "/account/security", "/mfa/verify",
        # E-commerce
        "/shop", "/cart", "/checkout", "/order/status",
        "/product/12345", "/category/electronics", "/wishlist",
        "/returns", "/track-order",
        # Content
        "/wiki/Main_Page", "/feed", "/notifications", "/messages",
        "/explore", "/trending", "/popular", "/latest",
        # Cloud/apps
        "/drive/my-drive", "/settings", "/dashboard", "/profile",
        "/docs", "/calendar/r/week", "/mail/u/0",
        # API-style
        "/api/v1", "/api/v2/users", "/v1/charges",
        # Locale
        "/en", "/en-gb", "/uk", "/us", "/fr", "/de",
        "/en-gb/products", "/gb/t/air-max",
        # Deep nested (critical for FP fix)
        "/guidance/apply-for-a-licence/step1",
        "/online-banking/personal/logon/login.jsp",
        "/gp/your-account/order-history",
        "/news/technology/2026/04/article",
        "/repos/user/repo/commits",
        "/file/d/1BxiMVs0XRA5nFMd/view",
        "/l/meetup-join/19meeting_abc123",
        "/accounts/login/phone-or-email",
        "/uas/login", "/i/flow/login",
        # File types
        "/document.pdf", "/report.xlsx", "/style.css",
        "/npm/bootstrap@5.0.0/dist/css/bootstrap.min.css",
        "/ftp/python/3.12.0/python-3.12.0-amd64.exe",
        "/archive/refs/tags/v6.7.tar.gz",
        # Misc real patterns
        "/j/123456789", "/r/python", "/watch",
        "/dp/B08N5WRWNW", "/itm/123456789",
        "/embed/dQw4w9WgXcQ", "/track/abc123def456",
        "/gp/product/B09G9HD6PD", "/s",
    ]
    add_path = rng.choice(legit_idx, size=int(len(legit_idx) * 0.85), replace=False)
    for idx in add_path:
        path = rng.choice(LEGIT_PATHS)
        url = df.at[idx, "url"].rstrip("/")
        df.at[idx, "url"] = url + path

    # ── AGGRESSIVE QUERY STRING INJECTION (60% of legit URLs) ────────────
    LEGIT_QUERIES = [
        # Tracking / analytics (most common FP trigger)
        "?utm_source=google&utm_medium=cpc&utm_campaign=spring2026",
        "?srsltid=AfmBOooM7ubH1pgpLsdXok9figfVv42b7gHHJd1hEx",
        "?gclid=CjwKCAiA1234abcDEF567ghiJKL890&utm_source=google",
        "?fbclid=IwAR0abc123def456ghi789jkl012mno345pqr678",
        "?msclkid=abc123def456ghi789&utm_campaign=ads_2026",
        "?ref=sr_1_1&tag=googhydr-21&linkCode=as2",
        "?utm_source=twitter&utm_medium=social&utm_content=abc123",
        "?utm_source=facebook&utm_medium=social&utm_campaign=breaking",
        "?utm_source=feedburner&utm_medium=feed&utm_campaign=Feed",
        "?utm_source=nl&utm_brand=wired&utm_mailing=abc123def456",
        # OAuth / auth tokens
        "?client_id=abc123&response_type=code&scope=openid",
        "?flowName=GlifWebSignIn&continue=https://mail.google.com",
        "?redirect_uri=https://example.com/callback&state=xyz789",
        "?code=abc123def&state=xyz789&session_state=abc",
        "?SAMLRequest=PHNhbWxwOkF1dGhu",
        "?nonce=abc123def456&response_type=code",
        # Search / pagination
        "?q=search+query&page=1&sort=relevance",
        "?k=laptop&ref=nb_sb_noss&url=search-alias%3Daps",
        "?_nkw=laptop&_sop=12&_ipg=48&rt=nc",
        "?page=2&limit=25&offset=50",
        "?pagination_token=abc123def456ghi789",
        # Locale
        "?lang=en&locale=en-GB&currency=GBP",
        "?hl=en_GB&gl=GB&authuser=0",
        "?country=GB&language=en&region=UK",
        # Tokens / sessions
        "?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        "?session=abc123xyz789&csrf=def456uvw012",
        "?verify_token=abc123def456ghi789jkl012",
        "?pwd=abc123def456ghi789jkl012mno345",
        # Cloud / presigned
        "?X-Amz-Signature=abc123def456&X-Amz-Expires=3600",
        "?usp=sharing&ouid=123456789",
        "?sv=2021-06-08&sig=abc123def456&se=2026-04-10",
        # E-commerce
        "?ie=UTF8&tag=googhydr-21&linkCode=as2&camp=1634",
        "?sku=abc123&colour=black&size=XL",
        "?offer=flash&expires=1712345678&code=SAVE20",
        # General
        "?format=json&pretty=true&version=2",
        "?debug=true&verbose=1",
        "?feature=new_ui&beta=true&env=staging",
        "?variant=b&experiment=homepage_test",
        "?callbackUrl=https://www.example.com/browse",
        "?next=https%3A%2F%2Fwww.example.com%2Fdashboard",
        "?dest=https%3A%2F%2Fwww.example.com%2Fr%2Fpython",
        "?redirect_after_login=https://example.com/home",
        "?continue=https://example.com/mail&service=mail",
        "?options=eyJpc3MiOiJ1cm46YmFtdGVjaDpzZXJ2aWNlIn0",
        "?product=firefox-latest-ssl&os=win64&lang=en-US",
    ]
    add_query = rng.choice(legit_idx, size=int(len(legit_idx) * 0.60), replace=False)
    for idx in add_query:
        url = df.at[idx, "url"]
        qs = rng.choice(LEGIT_QUERIES)
        if "?" in url:
            df.at[idx, "url"] = url + "&" + qs.lstrip("?")
        else:
            df.at[idx, "url"] = url + qs

    # ── AGGRESSIVE SUBDOMAIN INJECTION (50% of legit URLs) ───────────────
    LEGIT_SUBDOMAINS = [
        "drive.", "mail.", "accounts.", "signin.", "secure.",
        "login.", "auth.", "api.", "cdn.", "m.", "app.",
        "portal.", "my.", "admin.", "support.", "docs.",
        "calendar.", "meet.", "pay.", "console.", "cloud.",
        "static.", "update.", "verify.", "confirm.", "id.",
        "sso.", "account.", "myaccount.", "online.", "digital.",
        "personal.", "onlinebanking.",
    ]
    add_sub = rng.choice(legit_idx, size=int(len(legit_idx) * 0.50), replace=False)
    for idx in add_sub:
        url = df.at[idx, "url"]
        sub = rng.choice(LEGIT_SUBDOMAINS)
        url = url.replace("://www.", "://" + sub, 1)
        if sub not in url:
            url = url.replace("://", "://" + sub, 1)
        df.at[idx, "url"] = url

    # ── FRAGMENT INJECTION (10% — SPA hash routes) ───────────────────────
    LEGIT_FRAGMENTS = [
        "#section", "#top", "#main-content", "#contact-us",
        "#/dashboard/settings", "#/login/callback",
        "#inbox/FMfcgzGtwZZqRWxlDkZ", "#general",
        "#L42", "#History", "#map=15/51.5074/-0.1278",
    ]
    add_frag = rng.choice(legit_idx, size=int(len(legit_idx) * 0.10), replace=False)
    for idx in add_frag:
        frag = rng.choice(LEGIT_FRAGMENTS)
        df.at[idx, "url"] = df.at[idx, "url"] + frag

    n_no_www  = df.loc[legit_mask, "url"].str.contains("://www\\.").sum()
    n_https   = df.loc[legit_mask, "url"].str.startswith("https").sum()
    n_paths   = df.loc[legit_mask, "url"].apply(lambda u: len(u.split('/')) > 3).sum()
    n_queries = df.loc[legit_mask, "url"].str.contains("\\?").sum()
    n_subs    = df.loc[legit_mask, "url"].apply(
        lambda u: len(u.split("://")[1].split("/")[0].split(".")) > 2
        if "://" in u else False).sum()
    print(f"  ✓ Debiased legit URLs (out of {legit_mask.sum()}):")
    print(f"    www: {n_no_www} | https: {n_https} | paths: {n_paths} | queries: {n_queries} | subdomains: {n_subs}")
    return df


def load_local_csv():
    """Fall back to a user-supplied CSV in data/raw_urls.csv."""
    p = DATA_DIR / "raw_urls.csv"
    if p.exists():
        print(f"Loading local CSV from {p} …")
        df = pd.read_csv(p)
        if "url" in df.columns and "label" in df.columns:
            df = df[["url","label"]].dropna()
            df["label"] = df["label"].astype(int)
            print(f"  ✓ Loaded {len(df)} rows from local CSV.")
            return df
    return None

# ─── feature extraction ───────────────────────────────────────────────────────

import sys, pathlib as _pl
sys.path.insert(0, str(_pl.Path(__file__).parent))
from features import extract_features, FEATURE_NAMES

def build_features(df: pd.DataFrame):
    records = []
    bad = 0
    total = len(df)
    for i, url in enumerate(df["url"], 1):
        if i % 25000 == 0 or i == total:
            print(f"  Extracting features … {i}/{total}", flush=True)
        f = extract_features(str(url))
        if f is None:
            bad += 1
            records.append({n: 0 for n in FEATURE_NAMES})
        else:
            records.append(f)
    if bad:
        print(f"  ⚠ {bad} unparseable URLs (filled with zeros).")
    return pd.DataFrame(records, columns=FEATURE_NAMES)

# ─── model pipelines ──────────────────────────────────────────────────────────

def build_pipelines():
    return {
        "dummy": Pipeline([
            ("clf", DummyClassifier(strategy="most_frequent", random_state=SEED)),
        ]),
        "lr": Pipeline([
            ("scaler", StandardScaler()),
            ("clf", LogisticRegression(max_iter=1000, random_state=SEED, C=1.0)),
        ]),
        "rf": Pipeline([
            ("clf", RandomForestClassifier(
                n_estimators=300, max_depth=None, random_state=SEED, n_jobs=-1
            )),
        ]),
        "gbm": Pipeline([
            ("clf", GradientBoostingClassifier(
                n_estimators=200, learning_rate=0.1, max_depth=5, random_state=SEED
            )),
        ]),
    }

# ─── main ─────────────────────────────────────────────────────────────────────

def train():
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Load dataset — prefer real UCI data, fall back to local CSV
    df = load_phiusiil()
    if df is None:
        df = load_local_csv()
    if df is None:
        print("ERROR: No dataset available. Place a CSV with 'url' and 'label' columns")
        print(f"       in {DATA_DIR / 'raw_urls.csv'} and re-run.")
        return

    # Fix PhiUSIIL dataset bias (all legit URLs have www + https)
    df = debias_legit_urls(df)

    df.to_csv(DATA_DIR / "raw_urls.csv", index=False)
    print(f"  Class balance — phishing: {(df['label']==1).sum()}, "
          f"legitimate: {(df['label']==0).sum()}")

    # 2. Extract 18 URL features
    print("Extracting features …")
    X = build_features(df)
    y = df["label"].reset_index(drop=True)

    processed = pd.concat([X, y.rename("label")], axis=1)
    processed.to_csv(DATA_DIR / "processed.csv", index=False)
    print(f"  Feature matrix: {X.shape}")

    # 3. Train / test split (80/20, stratified, seed=42)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=SEED, stratify=y
    )
    X_train.to_csv(DATA_DIR / "X_train.csv", index=False)
    X_test.to_csv(DATA_DIR  / "X_test.csv",  index=False)
    y_train.to_csv(DATA_DIR / "y_train.csv", index=False)
    y_test.to_csv(DATA_DIR  / "y_test.csv",  index=False)
    print(f"  Train: {len(X_train)}, Test: {len(X_test)}")

    # Save feature names for API
    with open(MODELS_DIR / "feature_names.pkl", "wb") as f:
        pickle.dump(FEATURE_NAMES, f)

    # 4. Train all 4 models
    for name, pipe in build_pipelines().items():
        print(f"Training [{name}] …", end=" ", flush=True)
        pipe.fit(X_train, y_train)
        acc = pipe.score(X_test, y_test)
        with open(MODELS_DIR / f"{name}.pkl", "wb") as f:
            pickle.dump(pipe, f)
        print(f"done  (test accuracy: {acc:.4f})")

    print(f"\n✓ All models saved to {MODELS_DIR}")
    print("Next step: python -m src.evaluate")


if __name__ == "__main__":
    train()
