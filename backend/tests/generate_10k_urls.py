"""
Procedural URL Generator (Fuzzer) — 10,000 mathematically distinct URL structures.
Combines 5 buckets via itertools to exhaustively test the feature extractor.

Bucket 1: Base Targets (legitimate domains, IPs, typosquatted, suspicious TLDs)
Bucket 2: Path Structures (empty, nested, auth paths, file extensions)
Bucket 3: Query Strings (empty, tracking, tokens, OAuth, search params)
Bucket 4: Obfuscation (encoding, @ tricks, dashes, punycode)
Bucket 5: Parser Breakers (authority desync, backslash, zero-width, recursive encoding)
"""
import sys, os, csv, random, itertools, string, base64, hashlib
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import joblib
from src.features import extract_features, features_to_vector, FEATURE_NAMES

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# ═══════════════════════════════════════════════════════════════════════════════
# BUCKET 1: Base Domains
# ═══════════════════════════════════════════════════════════════════════════════
LEGIT_DOMAINS = [
    "google.com", "youtube.com", "facebook.com", "amazon.co.uk", "bbc.co.uk",
    "wikipedia.org", "apple.com", "microsoft.com", "twitter.com", "instagram.com",
    "linkedin.com", "netflix.com", "reddit.com", "github.com", "stackoverflow.com",
    "ebay.co.uk", "paypal.com", "spotify.com", "dropbox.com", "steam.com",
    "gov.uk", "nhs.uk", "hsbc.co.uk", "lloydsbank.com", "barclays.co.uk",
    "stripe.com", "twilio.com", "slack.com", "zoom.us", "adobe.com",
    "shopify.com", "etsy.com", "booking.com", "airbnb.com", "uber.com",
    "coca-cola.com", "rolls-royce.com", "bp.com", "bmw.com", "samsung.com",
]

LEGIT_SUBDOMAINS = [
    "mail", "drive", "accounts", "signin", "login", "secure", "api",
    "my", "app", "portal", "admin", "auth", "sso", "id", "account",
    "calendar", "docs", "meet", "pay", "console", "cloud", "cdn",
    "static", "update", "verify", "confirm", "support", "help", "dev",
]

IP_DOMAINS = [
    "192.168.1.1", "10.0.0.1", "172.16.0.1", "185.220.101.45",
    "45.33.32.156", "91.198.174.192", "104.244.42.193", "151.101.1.69",
]

TYPO_DOMAINS = [
    "g00gle.com", "gooogle.com", "goggle.com", "paypa1.com", "paypai.com",
    "arnazon.com", "arnazon.co.uk", "rnicrosoft.com", "faceb00k.com",
    "netfIix.com", "twltter.com", "1inkedin.com", "app1e.com", "yout0be.com",
    "instaqram.com", "amazom.com", "googie.com", "mlcrosoft.com",
]

SUSPICIOUS_TLD_DOMAINS = [
    "secure-login.tk", "paypal-update.ml", "account-verify.ga",
    "bank-secure.cf", "login-update.gq", "verify-now.xyz",
    "secure-banking.top", "update-account.club", "signin-portal.online",
    "verify-identity.site", "confirm-account.info",
]

# ═══════════════════════════════════════════════════════════════════════════════
# BUCKET 2: Path Structures
# ═══════════════════════════════════════════════════════════════════════════════
PATHS_CLEAN = ["", "/", "/about", "/news", "/products", "/contact", "/help"]
PATHS_DEEP = [
    "/a/b/c/d/e/f", "/users/123/orders/456/items/789",
    "/guidance/apply-for-a-licence/step1/personal/details",
    "/en-gb/products/electronics/laptops/gaming",
    "/api/v2/users/123/orders/456/items",
]
PATHS_AUTH = [
    "/login", "/signin", "/sign-in", "/verify", "/confirm",
    "/authenticate", "/auth/callback", "/oauth2/authorize",
    "/password/reset", "/account/security", "/sso/saml/login",
    "/2fa/setup", "/mfa/verify",
]
PATHS_FILE = [
    "/document.pdf", "/report.xlsx", "/image.png", "/file.zip",
    "/script.js", "/style.css", "/data.json", "/feed.xml",
]
PATHS_VERSION = ["/v1/charges", "/v2/users", "/api/v3/repos", "/v1/chat/completions"]
PATHS_LOCALE = ["/en/products", "/en-gb/account", "/fr/produits", "/de/produkte", "/uk", "/gb/t/air-max"]
PATHS_DATE = ["/2026/04/10/article-title", "/news/2026/breaking-story", "/blog/2025/12/post"]
PATHS_ID = [
    "/watch?v=dQw4w9WgXcQ", "/itm/123456789012",
    "/order/550e8400-e29b-41d4-a716-446655440000",
    "/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs/view",
]

ALL_PATHS = PATHS_CLEAN + PATHS_DEEP + PATHS_AUTH + PATHS_FILE + PATHS_VERSION + PATHS_LOCALE + PATHS_DATE + PATHS_ID

# ═══════════════════════════════════════════════════════════════════════════════
# BUCKET 3: Query Strings
# ═══════════════════════════════════════════════════════════════════════════════
def rand_token(n=20):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=n))

def rand_b64(n=40):
    return base64.urlsafe_b64encode(os.urandom(n)).decode().rstrip("=")

QUERIES_EMPTY = [""]
QUERIES_TRACKING = [
    f"utm_source=google&utm_medium=cpc&utm_campaign={rand_token(8)}",
    f"srsltid={rand_token(40)}",
    f"gclid={rand_token(30)}&utm_source=google",
    f"fbclid={rand_token(30)}",
    f"ref=sr_1_1&tag=googhydr-21&gclid={rand_token(15)}",
    f"utm_source=twitter&utm_medium=social&utm_content={rand_token(12)}",
    f"msclkid={rand_token(25)}&utm_campaign=ads",
]
QUERIES_OAUTH = [
    f"client_id={rand_token(12)}&response_type=code&scope=openid",
    f"code={rand_token(20)}&state={rand_token(15)}&redirect_uri=https://example.com/callback",
    f"flowName=GlifWebSignIn&continue=https://mail.google.com",
    f"SAMLRequest={rand_b64(60)}",
    f"nonce={rand_token(16)}&response_type=code&code_challenge={rand_token(32)}",
]
QUERIES_TOKEN = [
    f"token={rand_token(32)}",
    f"jwt={rand_b64(80)}",
    f"access_token={rand_b64(40)}&token_type=bearer",
    f"session={rand_token(24)}&csrf={rand_token(16)}",
    f"verify_token={rand_token(30)}&email=user@example.com",
    f"magic_token={rand_token(40)}&expires=1712345678",
]
QUERIES_SEARCH = [
    "q=laptop&category=electronics&min_price=500",
    "_nkw=laptop&_sop=12&_ipg=48&rt=nc",
    "k=laptop&ref=nb_sb_noss&url=search-alias%3Daps",
    "query=python&max_results=100&tweet.fields=created_at",
]
QUERIES_PAGE = [
    "page=2&limit=25", "p=3", "_pgn=4&_ipg=48",
    f"pagination_token={rand_token(20)}&per_page=100",
    f"cursor={rand_token(16)}&count=50",
    f"pageToken={rand_token(24)}&pageSize=20",
]
QUERIES_LOCALE = [
    "lang=en&locale=en-GB&currency=GBP",
    "hl=en_GB&gl=GB&authuser=0",
    "country=GB&language=en&region=UK",
]
QUERIES_DEBUG = [
    "debug=true&verbose=1&trace=on",
    "variant=b&experiment=homepage_test",
    "feature=new_ui&beta=true&env=staging",
]
QUERIES_PAYMENT = [
    f"token={rand_token(20)}&PayerID={rand_token(10)}",
    f"order_id={rand_token(12)}&status=complete",
    f"invoice={rand_token(16)}&amount=99.99&currency=GBP",
]
QUERIES_PRESIGNED = [
    f"X-Amz-Signature={rand_token(40)}&X-Amz-Expires=3600",
    f"X-Goog-Signature={rand_token(40)}&X-Goog-Expires=3600",
    f"sv=2021-06-08&sig={rand_token(40)}&se=2026-04-10",
]

ALL_QUERIES = (QUERIES_EMPTY + QUERIES_TRACKING + QUERIES_OAUTH + QUERIES_TOKEN +
               QUERIES_SEARCH + QUERIES_PAGE + QUERIES_LOCALE + QUERIES_DEBUG +
               QUERIES_PAYMENT + QUERIES_PRESIGNED)

# ═══════════════════════════════════════════════════════════════════════════════
# BUCKET 4: Obfuscation Techniques
# ═══════════════════════════════════════════════════════════════════════════════
def obfuscate_none(scheme, domain, path, query):
    """No obfuscation."""
    q = f"?{query}" if query else ""
    return f"{scheme}://{domain}{path}{q}"

def obfuscate_www(scheme, domain, path, query):
    """Add www. prefix."""
    q = f"?{query}" if query else ""
    return f"{scheme}://www.{domain}{path}{q}"

def obfuscate_subdomain(scheme, domain, path, query):
    """Add a random legitimate subdomain."""
    sub = random.choice(LEGIT_SUBDOMAINS)
    q = f"?{query}" if query else ""
    return f"{scheme}://{sub}.{domain}{path}{q}"

def obfuscate_at_trick(scheme, domain, path, query):
    """@ redirect trick — legit domain before @, phishing domain after."""
    q = f"?{query}" if query else ""
    return f"{scheme}://{random.choice(LEGIT_DOMAINS)}@{domain}{path}{q}"

def obfuscate_dash_heavy(scheme, domain, path, query):
    """Insert dashes to make domain look suspicious."""
    parts = domain.split(".")
    dashed = "-".join(list(parts[0][:6])) if len(parts[0]) > 3 else parts[0]
    rest = ".".join(parts[1:])
    q = f"?{query}" if query else ""
    return f"{scheme}://{dashed}-secure.{rest}{path}{q}"

def obfuscate_encoding(scheme, domain, path, query):
    """URL-encode parts of the path."""
    encoded_path = path.replace("/", "%2F") if path else ""
    q = f"?{query}" if query else ""
    return f"{scheme}://{domain}{encoded_path}{q}"

OBFUSCATORS_LEGIT = [obfuscate_none, obfuscate_www, obfuscate_subdomain]
OBFUSCATORS_PHISH = [obfuscate_none, obfuscate_at_trick, obfuscate_dash_heavy, obfuscate_encoding]

# ═══════════════════════════════════════════════════════════════════════════════
# BUCKET 5: Parser Breakers (Frankenstein URLs)
# ═══════════════════════════════════════════════════════════════════════════════
def gen_parser_breakers():
    """Generate ~500 extreme edge-case URLs."""
    urls = []

    # Authority desync: # before @
    for domain in LEGIT_DOMAINS[:10]:
        for evil in SUSPICIOUS_TLD_DOMAINS[:5]:
            urls.append(("Parser_Desync", f"http://{domain}#@{evil}/login", "PHISH"))

    # Backslash evasion
    for domain in SUSPICIOUS_TLD_DOMAINS[:8]:
        urls.append(("Parser_Backslash", f"http://{random.choice(LEGIT_DOMAINS[:5])}\\@{domain}\\login\\secure", "PHISH"))
    for domain in LEGIT_DOMAINS[:10]:
        urls.append(("Parser_Backslash", f"https://{domain}\\path\\to\\resource", "LEGIT"))

    # Zero-width injection
    ZWJ = "\u200d"
    ZWNJ = "\u200c"
    for base in ["paypal", "google", "amazon", "microsoft", "apple"]:
        for i in range(1, min(len(base), 4)):
            injected = base[:i] + random.choice([ZWJ, ZWNJ]) + base[i:]
            urls.append(("Parser_ZeroWidth", f"https://{injected}.com/verify", "PHISH"))

    # Recursive encoding
    for _ in range(30):
        inner = f"/{rand_token(8)}/login?user={rand_token(5)}"
        single_enc = inner.replace("/", "%2F").replace("?", "%3F").replace("=", "%3D")
        double_enc = single_enc.replace("%", "%25")
        urls.append(("Parser_DoubleEnc", f"http://{random.choice(SUSPICIOUS_TLD_DOMAINS)}{ double_enc}", "PHISH"))

    # Extremely long URLs (2000+ chars)
    for _ in range(20):
        domain = random.choice(LEGIT_DOMAINS[:10])
        long_path = "/".join([rand_token(8) for _ in range(20)])
        long_query = "&".join([f"{rand_token(5)}={rand_token(15)}" for _ in range(15)])
        urls.append(("Parser_LongURL", f"https://www.{domain}/{long_path}?{long_query}", "LEGIT"))

    # Fragment abuse
    for domain in LEGIT_DOMAINS[:10]:
        urls.append(("Parser_Fragment", f"https://{domain}/page#{rand_token(30)}", "LEGIT"))
        urls.append(("Parser_Fragment", f"https://{domain}/#/login/callback?token={rand_token(20)}", "LEGIT"))

    # Punycode-ish domains
    for _ in range(20):
        xn_domain = f"xn--{rand_token(12)}.ws"
        urls.append(("Parser_Punycode", f"http://{xn_domain}/login", "PHISH"))

    # Mixed: legitimate but extreme
    for domain in LEGIT_DOMAINS[:15]:
        b64_state = rand_b64(60)
        urls.append(("Parser_B64State", f"https://auth.{domain}/login?state={b64_state}&nonce={rand_token(16)}", "LEGIT"))

    # IP variants
    for _ in range(15):
        ip = f"{random.randint(1,255)}.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}"
        urls.append(("Parser_IP", f"http://{ip}/admin/login", "PHISH"))
        urls.append(("Parser_IP", f"http://{ip}:{random.choice([80,8080,8443,443])}/dashboard", "FP_RISK"))

    return urls


# ═══════════════════════════════════════════════════════════════════════════════
# GENERATOR — Combine all buckets
# ═══════════════════════════════════════════════════════════════════════════════
def generate_all():
    urls = []
    seen = set()

    def add(cat, url, expected):
        if url not in seen:
            seen.add(url)
            urls.append((cat, url, expected))

    # ── Legit domain combinations ─────────────────────────────────────────
    for domain in LEGIT_DOMAINS:
        for path in random.sample(ALL_PATHS, min(8, len(ALL_PATHS))):
            for query in random.sample(ALL_QUERIES, min(4, len(ALL_QUERIES))):
                for obf in OBFUSCATORS_LEGIT:
                    scheme = random.choice(["https", "https", "https", "http"])  # 75% https
                    url = obf(scheme, domain, path, query)
                    cat = f"Legit_{obf.__name__.replace('obfuscate_','')}"
                    add(cat, url, "LEGIT")

    # ── Typo domain combinations ──────────────────────────────────────────
    for domain in TYPO_DOMAINS:
        for path in random.sample(PATHS_AUTH + PATHS_CLEAN, min(5, len(PATHS_AUTH))):
            for query in random.sample(QUERIES_EMPTY + QUERIES_TOKEN[:2], 2):
                for obf in OBFUSCATORS_PHISH[:2]:
                    url = obf("http", domain, path, query)
                    add("Phish_Typo", url, "PHISH")

    # ── Suspicious TLD combinations ───────────────────────────────────────
    for domain in SUSPICIOUS_TLD_DOMAINS:
        for path in random.sample(PATHS_AUTH, min(4, len(PATHS_AUTH))):
            for query in random.sample(QUERIES_EMPTY + QUERIES_TOKEN[:2], 2):
                url = obfuscate_none("http", domain, path, query)
                add("Phish_SusTLD", url, "PHISH")

    # ── IP-based combinations ─────────────────────────────────────────────
    for ip in IP_DOMAINS:
        for path in random.sample(PATHS_AUTH + PATHS_CLEAN, min(4, len(PATHS_AUTH))):
            url = obfuscate_none("http", ip, path, "")
            add("Phish_IP", url, "PHISH")

    # ── @ trick combinations ──────────────────────────────────────────────
    for evil in SUSPICIOUS_TLD_DOMAINS[:6]:
        for path in PATHS_AUTH[:4]:
            url = obfuscate_at_trick("http", evil, path, "")
            add("Phish_AtTrick", url, "PHISH")

    # ── Dash-heavy phishing ───────────────────────────────────────────────
    for domain in SUSPICIOUS_TLD_DOMAINS:
        for path in PATHS_AUTH[:3]:
            url = obfuscate_dash_heavy("http", domain, path, "")
            add("Phish_DashHeavy", url, "PHISH")

    # ── Parser breakers ───────────────────────────────────────────────────
    for cat, url, expected in gen_parser_breakers():
        add(cat, url, expected)

    # ── FP Risk: legit domains with suspicious features ───────────────────
    for domain in LEGIT_DOMAINS[:20]:
        for path in PATHS_AUTH:
            for query in random.sample(QUERIES_OAUTH + QUERIES_TOKEN, min(3, len(QUERIES_OAUTH))):
                url = obfuscate_subdomain("https", domain, path, query)
                add("FP_Risk_AuthLegit", url, "FP_RISK")

    # Shuffle and trim to exactly 10,000
    random.shuffle(urls)
    if len(urls) > 10000:
        urls = urls[:10000]

    # Pad if under 10k with more legit combos
    while len(urls) < 10000:
        domain = random.choice(LEGIT_DOMAINS)
        path = random.choice(ALL_PATHS)
        query = random.choice(ALL_QUERIES)
        scheme = random.choice(["https", "http"])
        obf = random.choice(OBFUSCATORS_LEGIT)
        url = obf(scheme, domain, path, query)
        if url not in seen:
            seen.add(url)
            urls.append(("Legit_Padded", url, "LEGIT"))

    return urls[:10000]


def main():
    print("=" * 90)
    print("PhishGuard 10K URL Fuzzer — Procedural Generator")
    print("=" * 90)

    urls = generate_all()
    print(f"  Generated {len(urls)} unique URLs")

    # Count by category
    cats = {}
    expected_counts = {"LEGIT": 0, "PHISH": 0, "FP_RISK": 0}
    for cat, url, exp in urls:
        cats[cat] = cats.get(cat, 0) + 1
        expected_counts[exp] = expected_counts.get(exp, 0) + 1

    print(f"\n  Expected distribution:")
    for k, v in expected_counts.items():
        print(f"    {k:12s}: {v:>6d} ({v/len(urls)*100:.1f}%)")

    print(f"\n  Category breakdown:")
    for cat in sorted(cats.keys()):
        print(f"    {cat:30s}: {cats[cat]:>5d}")

    # ── Load model and score ─────────────────────────────────────────────
    MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
    rf = joblib.load(os.path.join(MODEL_DIR, "rf.pkl"))

    print(f"\n  Scoring all {len(urls)} URLs with Random Forest...")
    results = []
    parse_errors = 0
    for i, (cat, url, expected) in enumerate(urls):
        if i % 2000 == 0:
            print(f"    Progress: {i}/{len(urls)}...")
        feats = extract_features(url)
        if feats is None:
            results.append({"category": cat, "url": url, "expected": expected,
                            "rf_score": -1, "rf_verdict": "PARSE_ERR", "correct": False})
            parse_errors += 1
            continue
        vec = np.array(features_to_vector(feats)).reshape(1, -1)
        prob = rf.predict_proba(vec)[0][1]
        verdict = "PHISH" if prob >= 0.5 else "LEGIT"

        if expected == "LEGIT":
            correct = verdict == "LEGIT"
        elif expected == "PHISH":
            correct = verdict == "PHISH"
        else:  # FP_RISK
            correct = True  # We just track, don't penalize

        results.append({"category": cat, "url": url, "expected": expected,
                        "rf_score": round(prob, 4), "rf_verdict": verdict, "correct": correct})

    # ── Analyse results ──────────────────────────────────────────────────
    legit = [r for r in results if r["expected"] == "LEGIT"]
    phish = [r for r in results if r["expected"] == "PHISH"]
    fp_risk = [r for r in results if r["expected"] == "FP_RISK"]

    legit_correct = sum(1 for r in legit if r["correct"])
    phish_correct = sum(1 for r in phish if r["correct"])
    fp_risk_flagged = sum(1 for r in fp_risk if r["rf_verdict"] == "PHISH")

    print(f"\n{'=' * 90}")
    print(f"  RESULTS SUMMARY")
    print(f"{'=' * 90}")
    print(f"  Legitimate URLs:  {legit_correct}/{len(legit)} passed ({legit_correct/max(len(legit),1)*100:.1f}%) — FP rate: {(len(legit)-legit_correct)/max(len(legit),1)*100:.1f}%")
    print(f"  Phishing URLs:    {phish_correct}/{len(phish)} caught ({phish_correct/max(len(phish),1)*100:.1f}%) — FN rate: {(len(phish)-phish_correct)/max(len(phish),1)*100:.1f}%")
    print(f"  FP Risk URLs:     {fp_risk_flagged}/{len(fp_risk)} flagged ({fp_risk_flagged/max(len(fp_risk),1)*100:.1f}%) — legitimate with suspicious features")
    print(f"  Parse errors:     {parse_errors}")

    # False positives breakdown
    fps = [r for r in legit if not r["correct"]]
    if fps:
        print(f"\n  TOP FALSE POSITIVE CATEGORIES:")
        fp_cats = {}
        for r in fps:
            fp_cats[r["category"]] = fp_cats.get(r["category"], 0) + 1
        for cat in sorted(fp_cats, key=fp_cats.get, reverse=True)[:15]:
            print(f"    {cat:30s}: {fp_cats[cat]:>4d} FPs")

    # False negatives breakdown
    fns = [r for r in phish if not r["correct"]]
    if fns:
        print(f"\n  TOP FALSE NEGATIVE CATEGORIES:")
        fn_cats = {}
        for r in fns:
            fn_cats[r["category"]] = fn_cats.get(r["category"], 0) + 1
        for cat in sorted(fn_cats, key=fn_cats.get, reverse=True)[:10]:
            print(f"    {cat:30s}: {fn_cats[cat]:>4d} FNs")

    # ── Save CSV ─────────────────────────────────────────────────────────
    csv_path = os.path.join(os.path.dirname(__file__), "exhaustive_10k_test_suite.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["category", "url", "expected", "rf_score", "rf_verdict", "correct"])
        w.writeheader()
        w.writerows(results)
    print(f"\n  Full results saved to {csv_path}")
    print(f"{'=' * 90}")


if __name__ == "__main__":
    main()
