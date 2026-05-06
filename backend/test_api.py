"""Quick smoke test for the API."""
import urllib.request, json

def predict(url, model="rf"):
    body = json.dumps({"url": url, "model": model}).encode()
    req = urllib.request.Request(
        "http://localhost:8001/predict",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())

tests = [
    "http://paypal-secure-login.tk/verify",
    "http://confirm-banking-details.ml/signin",
    "http://service-mitld.firebaseapp.com/",
    "https://www.southbankmosaics.com",
    "https://www.stackoverflow.com",
    "https://www.bloomberg.com",
]

print("API smoke test (RF model):\n")
for url in tests:
    d = predict(url)
    status = "PHISHING" if d["is_phishing"] else "LEGIT"
    print(f"  [{status:8s}] prob={d['probability']:.3f}  risk={d['risk_label']:8s}  {url}")
    print(f"            top features: {', '.join(f['name'] for f in d['top5'])}")
print("\n✓ API is working correctly.")
