"""
URL feature extractor — mirrors the JS extractFeatures() function in Home.jsx.
All 18 features are derived purely from the URL string (no DNS/WHOIS lookups).
"""

import math
import re
from urllib.parse import urlparse

SUSPICIOUS_KEYWORDS = [
    "login", "secure", "verify", "account", "update", "banking",
    "confirm", "password", "signin", "webscr", "suspend", "unusual",
    "alert", "authenticate",
]

SUSPICIOUS_TLDS = [
    ".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top",
    ".club", ".online", ".site", ".info",
]

KNOWN_TRACKING_PARAMS = {
    "srsltid", "utm_source", "utm_medium", "utm_campaign", "utm_content",
    "utm_term", "gclid", "fbclid", "msclkid", "ref", "tag", "affiliate",
    "source", "campaign", "dclid", "gclsrc", "zanpid", "ref_",
    "referer", "referrer", "mc_cid", "mc_eid",
}

FEATURE_NAMES = [
    "url_length",
    "domain_length",
    "path_length",
    "has_www",
    "subdomain_count",
    "is_ip_domain",
    "has_at_symbol",
    "dash_count",
    "digit_ratio",
    "domain_entropy",
    "has_https",
    "keyword_count",
    "has_suspicious_tld",
    "percent_count",
    "underscore_count",
    "query_length",
    "has_tracking_params",
    "query_entropy",
]


def _shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {}
    for c in s:
        freq[c] = freq.get(c, 0) + 1
    n = len(s)
    return -sum((v / n) * math.log2(v / n) for v in freq.values())


def extract_features(url: str) -> dict:
    """
    Returns a dict with keys = FEATURE_NAMES and float values,
    plus 'domain' and 'is_https' for display purposes.
    Returns None if the URL cannot be parsed.
    """
    try:
        full = url if url.startswith("http") else "https://" + url
        parsed = urlparse(full)
        domain = parsed.hostname or ""
        path = parsed.path or ""
        query = parsed.query or ""

        url_len = len(url)
        dom_len = len(domain)
        path_len = len(path)

        parts = domain.split(".")
        subdomain_count = max(0, len(parts) - 2)
        has_www = 1 if domain.startswith("www.") else 0
        is_ip = 1 if re.match(r'^\d{1,3}(\.\d{1,3}){3}$', domain) else 0

        has_at = 1 if "@" in url else 0
        dash_count = len(re.findall(r"-", domain))
        digit_ratio = len(re.findall(r"\d", domain)) / max(len(domain), 1)
        entropy = _shannon_entropy(domain)
        is_https = 1 if url.startswith("https") else 0
        kw_count = sum(1 for k in SUSPICIOUS_KEYWORDS if k in url.lower())
        bad_tld = 1 if any(domain.endswith(t) for t in SUSPICIOUS_TLDS) else 0
        pct_count = len(re.findall(r"%", url))
        under_count = len(re.findall(r"_", url))

        # New features to reduce FPs on legit URLs with tracking params
        query_len = len(query)
        if query:
            from urllib.parse import parse_qs
            qparams = parse_qs(query, keep_blank_values=True)
            tracking_found = any(k.lower() in KNOWN_TRACKING_PARAMS for k in qparams)
            has_tracking = 1 if tracking_found else 0
        else:
            has_tracking = 0
        q_entropy = round(_shannon_entropy(query), 4)

        features = {
            "url_length": url_len,
            "domain_length": dom_len,
            "path_length": path_len,
            "has_www": has_www,
            "subdomain_count": subdomain_count,
            "is_ip_domain": is_ip,
            "has_at_symbol": has_at,
            "dash_count": dash_count,
            "digit_ratio": round(digit_ratio, 4),
            "domain_entropy": round(entropy, 4),
            "has_https": is_https,
            "keyword_count": kw_count,
            "has_suspicious_tld": bad_tld,
            "percent_count": pct_count,
            "underscore_count": under_count,
            "query_length": query_len,
            "has_tracking_params": has_tracking,
            "query_entropy": q_entropy,
        }
        return features
    except Exception:
        return None


def features_to_vector(features: dict) -> list:
    """Return features as an ordered list matching FEATURE_NAMES."""
    return [features[name] for name in FEATURE_NAMES]
