"""
Level 5: Adversarial Machine Learning — Genetic Algorithm URL Evolver.

Takes known phishing URLs and evolves them through mutations to find
the exact decision boundary of the Random Forest model.

The "fitness" of a URL = how LOW the phishing score is (closer to 0.0 = more evasive).
Each generation selects the top 10% most evasive URLs, breeds them, and mutates.

Output: evasion_success.csv showing Original → Evolved URL, Original → Evolved Score.
"""
import sys, os, csv, random, copy, string, math
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import numpy as np
import joblib
from src.features import extract_features, features_to_vector, FEATURE_NAMES

SEED = 42
random.seed(SEED)
np.random.seed(SEED)

# ── Load model ───────────────────────────────────────────────────────────────
MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
rf = joblib.load(os.path.join(MODEL_DIR, "rf.pkl"))

# ── Seed Phishing URLs (high-confidence True Positives) ──────────────────────
SEED_PHISHING = [
    "http://paypal-secure-login.tk/verify",
    "http://amazon-update-account.ml/signin",
    "http://secure-login-verify.xyz/account",
    "http://banking-update-confirm.ga/auth",
    "http://apple-id-verify.cf/signin",
    "http://microsoft-security-alert.gq/update",
    "http://netflix-billing-update.tk/account",
    "http://google-security-check.ml/verify",
    "http://facebook-confirm-identity.ga/login",
    "http://instagram-verify-account.cf/auth",
    "http://linkedin-security-update.xyz/signin",
    "http://twitter-account-verify.top/login",
    "http://dropbox-storage-alert.club/confirm",
    "http://spotify-payment-update.online/verify",
    "http://ebay-account-suspended.site/signin",
    "http://paypal-unusual-activity.info/confirm",
    "http://chase-banking-alert.tk/verify",
    "http://wells-fargo-update.ml/login",
    "http://citibank-security-notice.ga/auth",
    "http://hsbc-verify-identity.cf/signin",
    "http://barclays-online-update.gq/confirm",
    "http://lloyds-security-alert.xyz/verify",
    "http://natwest-account-verify.top/login",
    "http://santander-banking-alert.club/auth",
    "http://halifax-confirm-details.online/signin",
    "http://steam-trade-offer.tk/login",
    "http://discord-nitro-gift.ml/verify",
    "http://roblox-free-robux.ga/login",
    "http://fortnite-vbucks-generator.cf/signin",
    "http://minecraft-account-verify.gq/auth",
    "http://whatsapp-verify-number.xyz/confirm",
    "http://telegram-security-code.top/login",
    "http://zoom-meeting-invite.club/verify",
    "http://adobe-subscription-update.online/signin",
    "http://office365-password-expire.site/auth",
    "http://icloud-storage-full.info/verify",
    "http://amazon-prime-renew.tk/login",
    "http://uber-account-suspended.ml/verify",
    "http://airbnb-booking-confirm.ga/signin",
    "http://booking-payment-failed.cf/auth",
    "http://walmart-order-confirm.gq/verify",
    "http://target-account-alert.xyz/login",
    "http://costco-membership-renew.top/signin",
    "http://fedex-package-delivery.club/verify",
    "http://dhl-shipment-tracking.online/confirm",
    "http://usps-delivery-notice.site/login",
    "http://irs-tax-refund.info/verify",
    "http://hmrc-tax-rebate.tk/confirm",
    "http://gov-uk-council-tax.ml/signin",
    "http://nhs-covid-result.ga/verify",
]


def score_url(url):
    """Score a URL with the RF model. Returns probability of phishing (0-1) or 1.0 on error."""
    feats = extract_features(url)
    if feats is None:
        return 1.0
    vec = np.array(features_to_vector(feats)).reshape(1, -1)
    return rf.predict_proba(vec)[0][1]


# ═══════════════════════════════════════════════════════════════════════════════
# MUTATION OPERATORS
# ═══════════════════════════════════════════════════════════════════════════════
LEGIT_TLDS = [".com", ".co.uk", ".org", ".net", ".io", ".app", ".dev", ".edu"]
LEGIT_SUBS = ["www", "secure", "mail", "app", "portal", "my", "login", "account",
              "cdn", "api", "static", "docs", "drive", "cloud"]
LEGIT_PATHS = [
    "/products", "/about", "/help", "/en-gb", "/support", "/news",
    "/account/settings", "/user/profile", "/blog/2026",
    "/docs/getting-started", "/api/v2/status",
]
LEGIT_QUERY_PARTS = [
    "utm_source=google", "utm_medium=cpc", "ref=homepage",
    "lang=en", "locale=en-GB", "currency=GBP",
    "page=1", "sort=popular", "view=grid",
]
TRUSTED_KEYWORDS = ["google", "secure", "official", "support", "help", "verified"]


def mutate_swap_tld(url):
    """Replace suspicious TLD with legitimate one."""
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url if url.startswith("http") else "http://" + url)
        domain = parsed.hostname or ""
        new_tld = random.choice(LEGIT_TLDS)
        parts = domain.rsplit(".", 1) if ".co." not in domain else domain.rsplit(".", 2)
        new_domain = parts[0] + new_tld
        return url.replace(domain, new_domain, 1)
    except:
        return url


def mutate_add_https(url):
    """Convert http to https."""
    return url.replace("http://", "https://", 1)


def mutate_add_www(url):
    """Add www. prefix."""
    return url.replace("://", "://www.", 1) if "://www." not in url else url


def mutate_add_subdomain(url):
    """Add a trusted subdomain."""
    sub = random.choice(LEGIT_SUBS)
    return url.replace("://", f"://{sub}.", 1) if f"://{sub}." not in url else url


def mutate_pad_path(url):
    """Replace or append a legitimate-looking path."""
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url if url.startswith("http") else "http://" + url)
        new_path = random.choice(LEGIT_PATHS)
        base = f"{parsed.scheme}://{parsed.netloc}"
        query = f"?{parsed.query}" if parsed.query else ""
        return f"{base}{new_path}{query}"
    except:
        return url


def mutate_add_tracking_params(url):
    """Add legitimate tracking parameters to look like analytics."""
    params = "&".join(random.sample(LEGIT_QUERY_PARTS, min(3, len(LEGIT_QUERY_PARTS))))
    if "?" in url:
        return f"{url}&{params}"
    else:
        return f"{url}?{params}"


def mutate_simplify_domain(url):
    """Remove dashes from domain to reduce dash_count feature."""
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url if url.startswith("http") else "http://" + url)
        domain = parsed.hostname or ""
        # Remove some dashes
        simplified = domain.replace("-", "", random.randint(1, domain.count("-")))
        return url.replace(domain, simplified, 1)
    except:
        return url


def mutate_shorten_domain(url):
    """Shorten the domain name to reduce domain_length."""
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url if url.startswith("http") else "http://" + url)
        domain = parsed.hostname or ""
        parts = domain.split(".")
        if len(parts[0]) > 6:
            parts[0] = parts[0][:random.randint(4, 7)]
        new_domain = ".".join(parts)
        return url.replace(domain, new_domain, 1)
    except:
        return url


def mutate_remove_keywords(url):
    """Remove suspicious keywords from the path."""
    for kw in ["login", "signin", "verify", "confirm", "update", "secure", "alert",
               "suspend", "authenticate", "password", "banking", "account"]:
        if kw in url.split("?")[0].lower():
            url = url.replace(f"/{kw}", random.choice(["/home", "/main", "/page", "/info"]), 1)
            break
    return url


ALL_MUTATIONS = [
    mutate_swap_tld, mutate_add_https, mutate_add_www, mutate_add_subdomain,
    mutate_pad_path, mutate_add_tracking_params, mutate_simplify_domain,
    mutate_shorten_domain, mutate_remove_keywords,
]


# ═══════════════════════════════════════════════════════════════════════════════
# GENETIC ALGORITHM
# ═══════════════════════════════════════════════════════════════════════════════
def evolve(seed_urls, generations=50, population_size=100, elite_pct=0.10, mutation_rate=0.7):
    """
    Genetic algorithm to evolve phishing URLs into model-evading variants.
    
    Fitness = 1.0 - phishing_score (higher = more evasive)
    """
    print(f"\n{'═' * 90}")
    print(f"  ADVERSARIAL EVOLVER — Genetic Algorithm")
    print(f"  Seeds: {len(seed_urls)} | Generations: {generations} | Pop: {population_size}")
    print(f"{'═' * 90}")

    all_results = []

    for seed_idx, seed_url in enumerate(seed_urls):
        original_score = score_url(seed_url)
        if original_score < 0.5:
            continue  # Skip if not flagged as phishing

        # Initialize population with mutations of the seed
        population = []
        for _ in range(population_size):
            candidate = seed_url
            n_mutations = random.randint(1, 4)
            for _ in range(n_mutations):
                mutation_fn = random.choice(ALL_MUTATIONS)
                candidate = mutation_fn(candidate)
            population.append(candidate)

        best_url = seed_url
        best_score = original_score
        best_gen = 0

        for gen in range(generations):
            # Score all candidates
            scored = []
            for url in population:
                s = score_url(url)
                fitness = 1.0 - s  # Lower phishing score = higher fitness
                scored.append((url, s, fitness))

            # Sort by fitness (most evasive first)
            scored.sort(key=lambda x: x[2], reverse=True)

            # Track best
            if scored[0][1] < best_score:
                best_score = scored[0][1]
                best_url = scored[0][0]
                best_gen = gen

            # Early exit if we found a full evasion
            if best_score < 0.1:
                break

            # Select elite
            elite_count = max(2, int(population_size * elite_pct))
            elites = [s[0] for s in scored[:elite_count]]

            # Breed next generation
            new_population = list(elites)  # Keep elites
            while len(new_population) < population_size:
                # Crossover: pick two parents
                p1 = random.choice(elites)
                p2 = random.choice(elites)

                # Child = start with p1, apply random mutation from p2's "genes"
                child = p1
                if random.random() < mutation_rate:
                    mutation_fn = random.choice(ALL_MUTATIONS)
                    child = mutation_fn(child)
                if random.random() < mutation_rate * 0.5:
                    mutation_fn = random.choice(ALL_MUTATIONS)
                    child = mutation_fn(child)

                new_population.append(child)

            population = new_population

        # Record result
        score_drop = original_score - best_score
        evaded = best_score < 0.5
        result = {
            "seed_url": seed_url,
            "seed_score": round(original_score, 4),
            "evolved_url": best_url,
            "evolved_score": round(best_score, 4),
            "score_drop": round(score_drop, 4),
            "generation": best_gen,
            "evaded": evaded,
        }
        all_results.append(result)

        status = "🔓 EVADED" if evaded else "🔒 HELD"
        if (seed_idx + 1) % 10 == 0 or evaded:
            print(f"  [{seed_idx+1:>3d}/{len(seed_urls)}] {status}  {original_score:.3f} → {best_score:.3f}  (gen {best_gen})")

    return all_results


def main():
    print("=" * 90)
    print("PhishGuard Adversarial Evolver — Level 5 Red Team AI")
    print("=" * 90)

    results = evolve(SEED_PHISHING, generations=50, population_size=80)

    # ── Analysis ─────────────────────────────────────────────────────────
    evaded = [r for r in results if r["evaded"]]
    held = [r for r in results if not r["evaded"]]

    print(f"\n{'═' * 90}")
    print(f"  FINAL RESULTS")
    print(f"{'═' * 90}")
    print(f"  Total seeds tested:    {len(results)}")
    print(f"  Successfully evaded:   {len(evaded)} ({len(evaded)/max(len(results),1)*100:.1f}%)")
    print(f"  Model held firm:       {len(held)} ({len(held)/max(len(results),1)*100:.1f}%)")

    if evaded:
        avg_drop = np.mean([r["score_drop"] for r in evaded])
        avg_gen = np.mean([r["generation"] for r in evaded])
        print(f"  Avg score drop (evaded): {avg_drop:.3f}")
        print(f"  Avg generation found:    {avg_gen:.1f}")
        print(f"\n  TOP 10 MOST SUCCESSFUL EVASIONS:")
        for r in sorted(evaded, key=lambda x: x["evolved_score"])[:10]:
            print(f"    {r['seed_score']:.3f} → {r['evolved_score']:.3f}  gen={r['generation']:>2d}  {r['evolved_url'][:80]}")

    if held:
        print(f"\n  MOST RESISTANT PHISHING URLs (hardest to evade):")
        for r in sorted(held, key=lambda x: x["evolved_score"], reverse=True)[:10]:
            print(f"    {r['seed_score']:.3f} → {r['evolved_score']:.3f}  {r['seed_url'][:80]}")

    # ── Mutation effectiveness ───────────────────────────────────────────
    print(f"\n  EVASION TECHNIQUES USED (in successful evasions):")
    if evaded:
        # Analyze what changed between seed and evolved
        technique_counts = {"TLD Swap": 0, "HTTPS": 0, "WWW": 0, "Subdomain": 0,
                            "Path Change": 0, "Tracking Params": 0, "Dash Remove": 0,
                            "Domain Shorten": 0, "Keyword Remove": 0}
        for r in evaded:
            if r["seed_url"].split(".")[-1] != r["evolved_url"].split(".")[-1]:
                technique_counts["TLD Swap"] += 1
            if "https://" in r["evolved_url"] and "http://" in r["seed_url"]:
                technique_counts["HTTPS"] += 1
            if "www." in r["evolved_url"] and "www." not in r["seed_url"]:
                technique_counts["WWW"] += 1
            if r["evolved_url"].count(".") > r["seed_url"].count("."):
                technique_counts["Subdomain"] += 1
            if "utm_" in r["evolved_url"] or "ref=" in r["evolved_url"]:
                technique_counts["Tracking Params"] += 1
            if r["evolved_url"].count("-") < r["seed_url"].count("-"):
                technique_counts["Dash Remove"] += 1

        for tech in sorted(technique_counts, key=technique_counts.get, reverse=True):
            if technique_counts[tech] > 0:
                print(f"    {tech:20s}: {technique_counts[tech]:>4d}")

    # ── Save CSV ─────────────────────────────────────────────────────────
    csv_path = os.path.join(os.path.dirname(__file__), "evasion_success.csv")
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["seed_url", "seed_score", "evolved_url",
                                           "evolved_score", "score_drop", "generation", "evaded"])
        w.writeheader()
        w.writerows(results)
    print(f"\n  Results saved to {csv_path}")
    print(f"{'═' * 90}")


if __name__ == "__main__":
    main()
