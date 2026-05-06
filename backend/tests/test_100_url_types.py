"""
Comprehensive test: 100 URL structure types across 19 categories.
Tests ALL legitimate URL patterns the model should NOT flag as phishing.
Also tests known phishing patterns the model SHOULD flag.
Outputs a detailed CSV report.
"""
import sys, os, csv, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import joblib
import numpy as np
from src.features import extract_features, features_to_vector, FEATURE_NAMES

# ── Load best model ──────────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
rf = joblib.load(os.path.join(MODEL_DIR, "rf.pkl"))
gbm = joblib.load(os.path.join(MODEL_DIR, "gbm.pkl"))

# ── 100 URL Types — ALL LEGITIMATE ──────────────────────────────────────────
LEGIT_TESTS = [
    # ── CAT 1: Google Shopping Tracking ──
    ("Google Shopping Tracking", "https://www.pokemoncenter.com/en-gb?srsltid=AfmBOooM7ubH1-pgpLsdXok9figfVv42b7gHHJd1hEx_a3qsC25mhh4B"),
    ("Google Shopping Tracking", "https://www.amazon.co.uk/dp/B08N5WRWNW?ref=sr_1_1&tag=googhydr-21&gclid=Cj0KCQiA"),
    ("Google Shopping Tracking", "https://www.currys.co.uk/products/samsung-tv.html?srsltid=AfmBOooM7ubH1pgpLsdX"),

    # ── CAT 2: Google Analytics UTM ──
    ("Google Analytics UTM", "https://www.bbc.co.uk/news/uk?utm_source=google&utm_medium=cpc&utm_campaign=news2026"),
    ("Google Analytics UTM", "https://www.theguardian.com/politics?utm_source=facebook&utm_medium=social&utm_campaign=breaking"),
    ("Google Analytics UTM", "https://www.forbes.com/sites/tech/?utm_campaign=forbesmagazine&utm_source=google&utm_medium=organic"),

    # ── CAT 3: OAuth Login Pages ──
    ("OAuth Login Pages", "https://signin.microsoftonline.com/oauth2/authorize?client_id=abc123&response_type=code"),
    ("OAuth Login Pages", "https://accounts.google.com/signin/v2/identifier?flowName=GlifWebSignIn"),
    ("OAuth Login Pages", "https://auth.atlassian.com/login?application=jira&continue=https://jira.atlassian.com"),

    # ── CAT 4: Long Redirect URLs ──
    ("Redirect URLs", "https://www.facebook.com/login/?next=https%3A%2F%2Fwww.facebook.com%2Fgroups%2F123456"),
    ("Redirect URLs", "https://twitter.com/i/flow/login?redirect_after_login=https://twitter.com/home"),
    ("Redirect URLs", "https://www.reddit.com/login/?dest=https%3A%2F%2Fwww.reddit.com%2Fr%2Fpython"),

    # ── CAT 5: Base64 Tokens ──
    ("Base64 Tokens", "https://auth.disney.com/login?options=eyJpc3MiOiJ1cm46YmFtdGVjaDpzZXJ2aWNlOmFjY291bnQifQ"),
    ("Base64 Tokens", "https://accounts.spotify.com/en-GB/login?continue=https://open.spotify.com&utm_source=google"),
    ("Base64 Tokens", "https://api.example.com/verify?jwt=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9"),

    # ── CAT 6: Clean URLs ──
    ("Clean URL", "https://www.google.com"),
    ("Clean URL", "https://www.youtube.com"),
    ("Clean URL", "https://www.wikipedia.org"),

    # ── CAT 7: URL with path ──
    ("URL with Path", "https://www.bbc.co.uk/news/technology"),
    ("URL with Path", "https://www.github.com/torvalds/linux"),
    ("URL with Path", "https://docs.python.org/3/library/os.html"),

    # ── CAT 8: URL with query string ──
    ("URL with Query", "https://www.amazon.co.uk/s?k=laptop"),
    ("URL with Query", "https://www.google.com/search?q=weather"),
    ("URL with Query", "https://www.ebay.co.uk/sch?_nkw=laptop&_sop=12&rt=nc"),

    # ── CAT 9: URL with fragment ──
    ("URL with Fragment", "https://www.wikipedia.org/wiki/Python_(programming_language)#History"),
    ("URL with Fragment", "https://docs.python.org/3/library/os.html#os.path"),
    ("URL with Fragment", "https://developer.mozilla.org/en-US/docs/Web#HTTP"),

    # ── CAT 10: Subdomain URLs ──
    ("Subdomain URLs", "https://mail.google.com"),
    ("Subdomain URLs", "https://drive.google.com/drive/my-drive"),
    ("Subdomain URLs", "https://calendar.google.com/calendar/r/week"),

    # ── CAT 11: Multiple Subdomains ──
    ("Multiple Subdomains", "https://secure.login.gov.uk/personal/account"),
    ("Multiple Subdomains", "https://personal.tax.service.gov.uk/gg/sign-in"),
    ("Multiple Subdomains", "https://online.banking.lloydsbank.co.uk/personal"),

    # ── CAT 12: Country Code TLD ──
    ("Country Code TLD", "https://www.bbc.co.uk/news"),
    ("Country Code TLD", "https://www.amazon.co.uk"),
    ("Country Code TLD", "https://www.gov.uk/guidance/coronavirus-covid-19"),

    # ── CAT 13: Corporate Subdomains ──
    ("Corporate Subdomains", "https://secure.bankofamerica.com/login/sign-in/signOnV2Screen.go"),
    ("Corporate Subdomains", "https://signin.aws.amazon.com/signin?redirect_uri=https://console.aws.amazon.com"),
    ("Corporate Subdomains", "https://sso.google.com/enterprise/vfe?continue=https://mail.google.com"),

    # ── CAT 14: Amazon Legitimate ──
    ("Amazon Legitimate", "https://www.amazon.co.uk/gp/your-account/order-history?ref_=ya_d_c_yo"),
    ("Amazon Legitimate", "https://www.amazon.co.uk/s?k=laptop&ref=nb_sb_noss&url=search-alias%3Daps"),
    ("Amazon Legitimate", "https://www.amazon.co.uk/gp/product/B09G9HD6PD?ie=UTF8&tag=googhydr-21&linkCode=as2"),

    # ── CAT 15: Banking & Finance ──
    ("Banking & Finance", "https://www.lloydsbank.com/online-banking/personal/logon/login.jsp"),
    ("Banking & Finance", "https://www.hsbc.co.uk/mortgages/tools/repayment-calculator/?interestRate=4.5&loanAmount=200000"),
    ("Banking & Finance", "https://onlinebanking.santander.co.uk/retail/login/start.bds?lang=en"),

    # ── CAT 16: Government & Official ──
    ("Government URLs", "https://www.gov.uk/guidance/coronavirus-covid-19-what-has-changed?utm_source=google"),
    ("Government URLs", "https://www.hmrc.gov.uk/login?continue=https://www.tax.service.gov.uk/account"),
    ("Government URLs", "https://www.nhs.uk/nhs-login/?redirect_uri=https://www.nhs.uk/health-records"),

    # ── CAT 17: Microsoft & Office ──
    ("Microsoft URLs", "https://login.microsoftonline.com/common/oauth2/v2.0/token?grant_type=authorization_code"),
    ("Microsoft URLs", "https://outlook.office365.com/owa/?realm=company.com&exsvurl=1"),
    ("Microsoft URLs", "https://myaccount.microsoft.com/security-info/update?reauth=1"),

    # ── CAT 18: Google Services ──
    ("Google Services", "https://myaccount.google.com/security-checkup/3?continue=https://myaccount.google.com"),
    ("Google Services", "https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms/view?usp=sharing"),
    ("Google Services", "https://console.cloud.google.com/iam-admin/iam?project=my-project-123456&authuser=0"),

    # ── CAT 19: Social Media Login ──
    ("Social Media Login", "https://www.instagram.com/accounts/login/?next=/p/abc123def456/&source=desktop_nav"),
    ("Social Media Login", "https://www.linkedin.com/uas/login?session_redirect=https://www.linkedin.com/feed/"),
    ("Social Media Login", "https://accounts.snapchat.com/accounts/login?continue=https://web.snapchat.com"),

    # ── CAT 20: E-commerce Tracking ──
    ("E-commerce Tracking", "https://www.etsy.com/uk/listing/123456789/handmade-item?ga_order=most_relevant&ga_search_type=all"),
    ("E-commerce Tracking", "https://www.asos.com/search/?q=trainers&iid=1&channel=mobile-web&country=GB&lang=en-GB"),
    ("E-commerce Tracking", "https://www.boohoo.com/dresses?utm_source=google&srsltid=AfmBOoo123&pla=true&gclid=abc"),

    # ── CAT 21: Developer / API ──
    ("Developer API", "https://api.stripe.com/v1/charges?limit=10&starting_after=ch_abc123"),
    ("Developer API", "https://api.github.com/repos/torvalds/linux/commits?sha=master&per_page=100&page=1"),
    ("Developer API", "https://registry.npmjs.org/react/-/react-18.2.0.tgz"),

    # ── CAT 22: Password Managers ──
    ("Password Managers", "https://vault.bitwarden.com/#/login?email=user@example.com"),
    ("Password Managers", "https://account.1password.com/signin?a=abc123&domain=my.1password.com"),
    ("Password Managers", "https://www.lastpass.com/misc/login.php?from=https://lastpass.com/vault/"),

    # ── CAT 23: Video & Streaming ──
    ("Streaming Login", "https://www.netflix.com/gb/login?callbackUrl=https://www.netflix.com/browse&preferredLocale=en-GB"),
    ("Streaming Login", "https://auth.disney.com/login?options=eyJpc3MiOiJ1cm46YmFtdGVjaCI6InNlcnZpY2UifQ"),
    ("Streaming Login", "https://account.sky.com/signin?continue=https://www.sky.com/shop&client_id=skycom"),

    # ── CAT 24: Verify & Confirm ──
    ("Verify & Confirm", "https://verify.stripe.com/identity/verification?token=vs_abc123def456"),
    ("Verify & Confirm", "https://confirm.booking.com/confirmations/email?token=abc123&lang=en-gb"),
    ("Verify & Confirm", "https://verify.airbnb.com/account/email_verification?token=abc123&locale=en-GB"),

    # ── CAT 25: URL with numeric ID ──
    ("Numeric ID", "https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ("Numeric ID", "https://www.ebay.co.uk/itm/123456789012"),
    ("Numeric ID", "https://stackoverflow.com/questions/12345678/python-question"),

    # ── CAT 26: Hyphenated domain ──
    ("Hyphenated Domain", "https://www.coca-cola.com/products"),
    ("Hyphenated Domain", "https://www.rolls-royce.com/about"),
    ("Hyphenated Domain", "https://www.hewlett-packard.com/support"),

    # ── CAT 27: CDN & Static Assets ──
    ("CDN Assets", "https://cdn.jsdelivr.net/npm/bootstrap@5.0.0/dist/css/bootstrap.min.css"),
    ("CDN Assets", "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js"),
    ("CDN Assets", "https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"),

    # ── CAT 28: File Downloads ──
    ("File Downloads", "https://download.mozilla.org/?product=firefox-latest-ssl&os=win64&lang=en-US"),
    ("File Downloads", "https://www.python.org/ftp/python/3.12.0/python-3.12.0-amd64.exe"),
    ("File Downloads", "https://github.com/torvalds/linux/archive/refs/tags/v6.7.tar.gz"),

    # ── CAT 29: Presigned Cloud URLs ──
    ("Cloud Storage", "https://s3.amazonaws.com/bucket/file?X-Amz-Signature=abc123&Expires=1712345678"),
    ("Cloud Storage", "https://storage.googleapis.com/bucket/object?X-Goog-Signature=abc123"),
    ("Cloud Storage", "https://blob.core.windows.net/container/file?sv=2021-06-08&sig=abc123"),

    # ── CAT 30: Meeting URLs ──
    ("Meeting URLs", "https://zoom.us/j/123456789?pwd=abc123def456ghi789jkl012mno345"),
    ("Meeting URLs", "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123%40thread.v2/0?context="),
    ("Meeting URLs", "https://meet.google.com/abc-defg-hij?authuser=0"),

    # ── CAT 31: Simple Well-Known ──
    ("Simple Well-Known", "https://www.apple.com"),
    ("Simple Well-Known", "https://www.microsoft.com"),
    ("Simple Well-Known", "https://www.stackoverflow.com"),

    # ── CAT 32: Pagination ──
    ("Pagination", "https://www.reddit.com/r/python?page=2&limit=25"),
    ("Pagination", "https://news.ycombinator.com/news?p=2"),
    ("Pagination", "https://www.ebay.co.uk/sch?_nkw=laptop&_pgn=3&_ipg=48"),

    # ── CAT 33: Locale in Path ──
    ("Locale Path", "https://www.pokemon.com/uk"),
    ("Locale Path", "https://www.nike.com/gb/t/air-max"),
    ("Locale Path", "https://www.adidas.co.uk/en-gb/ultraboost"),
]

# ── Known PHISHING URLs (model SHOULD flag) ─────────────────────────────────
PHISH_TESTS = [
    ("TLD Phishing", "http://paypal-secure-login.tk/verify"),
    ("TLD Phishing", "http://amazon-update-account.ml/signin"),
    ("TLD Phishing", "http://secure-login-verify-account.xyz"),
    ("@ Redirect", "http://amazon.com@phishing.ml/login"),
    ("@ Redirect", "http://google.com@evil-site.tk/signin"),
    ("IP Address", "http://185.220.101.45/banking/signin"),
    ("IP Address", "http://192.168.1.1/login@bank.com/update"),
    ("Keyword Stuffing", "http://paypal-secure-update-verify-account.com/login"),
    ("Keyword Stuffing", "http://apple-id-verify-confirm-signin.com/auth"),
    ("URL Encoding", "http://paypal%2Ecom%2Flogin%2Fverify"),
    ("Homoglyph", "http://www.paypa1.com/signin"),
    ("Homoglyph", "http://www.g00gle.com/login"),
    ("Long Phish", "http://secure-banking-update-your-account-immediately-verify-now.tk/auth/confirm"),
    ("Dash Heavy", "http://pay-pal-secure-login-verify-account.cf/signin"),
    ("Mixed Signals", "http://signin-amazon-update.com/account"),
]


def score_url(url, model):
    feats = extract_features(url)
    if feats is None:
        return None
    vec = np.array(features_to_vector(feats)).reshape(1, -1)
    prob = model.predict_proba(vec)[0][1]
    return prob


def main():
    print("=" * 90)
    print("PhishGuard Comprehensive URL Test — 100 Types × 19 Categories")
    print(f"Features: {len(FEATURE_NAMES)} → {FEATURE_NAMES}")
    print("=" * 90)

    results = []
    threshold = 0.5

    # ── Test Legitimate URLs ─────────────────────────────────────────────────
    print(f"\n{'─' * 90}")
    print(f"  LEGITIMATE URLs (should score < {threshold})")
    print(f"{'─' * 90}")

    fp_count = 0
    cat_results = {}
    for cat, url in LEGIT_TESTS:
        rf_score = score_url(url, rf)
        gbm_score = score_url(url, gbm)
        if rf_score is None:
            status = "PARSE_ERR"
            rf_score = -1
            gbm_score = -1
        elif rf_score < threshold:
            status = "✓ PASS"
        else:
            status = "✗ FP"
            fp_count += 1

        if cat not in cat_results:
            cat_results[cat] = {"pass": 0, "fail": 0, "total": 0}
        cat_results[cat]["total"] += 1
        if status == "✓ PASS":
            cat_results[cat]["pass"] += 1
        else:
            cat_results[cat]["fail"] += 1

        short_url = url[:70] + "…" if len(url) > 70 else url
        print(f"  {status:10s}  RF={rf_score:.3f}  GBM={gbm_score:.3f}  [{cat:25s}] {short_url}")
        results.append({
            "category": cat, "url": url, "expected": "LEGIT",
            "rf_score": rf_score, "gbm_score": gbm_score,
            "rf_verdict": "PHISH" if rf_score >= threshold else "LEGIT",
            "correct": rf_score < threshold
        })

    legit_total = len(LEGIT_TESTS)
    legit_pass = legit_total - fp_count
    print(f"\n  LEGITIMATE SUMMARY: {legit_pass}/{legit_total} passed ({legit_pass/legit_total*100:.1f}%)")
    print(f"  FALSE POSITIVES: {fp_count}/{legit_total} ({fp_count/legit_total*100:.1f}%)")

    print(f"\n  {'Category':30s} {'Pass':>6s} {'Fail':>6s} {'Rate':>8s}")
    print(f"  {'─'*56}")
    for cat in cat_results:
        r = cat_results[cat]
        rate = r["pass"] / r["total"] * 100
        mark = "✓" if rate == 100 else "✗" if rate < 50 else "~"
        print(f"  {mark} {cat:28s} {r['pass']:>6d} {r['fail']:>6d} {rate:>7.1f}%")

    # ── Test Phishing URLs ───────────────────────────────────────────────────
    print(f"\n{'─' * 90}")
    print(f"  PHISHING URLs (should score >= {threshold})")
    print(f"{'─' * 90}")

    fn_count = 0
    for cat, url in PHISH_TESTS:
        rf_score = score_url(url, rf)
        gbm_score = score_url(url, gbm)
        if rf_score is None:
            status = "PARSE_ERR"
            rf_score = -1
            gbm_score = -1
        elif rf_score >= threshold:
            status = "✓ CAUGHT"
        else:
            status = "✗ MISSED"
            fn_count += 1

        short_url = url[:70] + "…" if len(url) > 70 else url
        print(f"  {status:10s}  RF={rf_score:.3f}  GBM={gbm_score:.3f}  [{cat:25s}] {short_url}")
        results.append({
            "category": cat, "url": url, "expected": "PHISH",
            "rf_score": rf_score, "gbm_score": gbm_score,
            "rf_verdict": "PHISH" if rf_score >= threshold else "LEGIT",
            "correct": rf_score >= threshold
        })

    phish_total = len(PHISH_TESTS)
    phish_caught = phish_total - fn_count
    print(f"\n  PHISHING SUMMARY: {phish_caught}/{phish_total} caught ({phish_caught/phish_total*100:.1f}%)")
    print(f"  FALSE NEGATIVES: {fn_count}/{phish_total} ({fn_count/phish_total*100:.1f}%)")

    # ── Overall ──────────────────────────────────────────────────────────────
    total = legit_total + phish_total
    correct = legit_pass + phish_caught
    print(f"\n{'=' * 90}")
    print(f"  OVERALL: {correct}/{total} correct ({correct/total*100:.1f}%)")
    print(f"  FPR on legit: {fp_count/legit_total*100:.1f}%")
    print(f"  FNR on phish: {fn_count/phish_total*100:.1f}%")
    print(f"{'=' * 90}")

    # ── Write CSV ────────────────────────────────────────────────────────────
    csv_path = os.path.join(os.path.dirname(__file__), "test_100_types_results.csv")
    with open(csv_path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["category", "url", "expected", "rf_score", "gbm_score", "rf_verdict", "correct"])
        w.writeheader()
        w.writerows(results)
    print(f"\n  Results saved to {csv_path}")


if __name__ == "__main__":
    main()
