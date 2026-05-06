"""Check feature distributions between phishing and legit in the dataset."""
import pandas as pd

df = pd.read_csv("data/processed.csv")
phish = df[df.label == 1]
legit = df[df.label == 0]

print(f"Phishing: {len(phish)}, Legit: {len(legit)}\n")
print(f"{'Feature':<22} {'Phish mean':>12} {'Legit mean':>12} {'Diff':>10}")
print("-" * 60)
for col in df.columns:
    if col == "label":
        continue
    pm = phish[col].mean()
    lm = legit[col].mean()
    print(f"{col:<22} {pm:>12.3f} {lm:>12.3f} {pm-lm:>10.3f}")

# check www and https breakdown
print("\n--- Breakdown for key binary features ---")
for feat in ["has_www", "has_https", "is_ip_domain"]:
    if feat in df.columns:
        print(f"\n{feat}:")
        print(f"  Phishing:  {feat}=1: {(phish[feat]==1).sum()}, {feat}=0: {(phish[feat]==0).sum()}")
        print(f"  Legit:     {feat}=1: {(legit[feat]==1).sum()}, {feat}=0: {(legit[feat]==0).sum()}")

# Check raw URLs
raw = pd.read_csv("data/raw_urls.csv")
legit_raw = raw[raw.label==0]
print(f"\nLegit URLs without www: {legit_raw[~legit_raw.url.str.contains('www.')].shape[0]}")
print(f"Legit URLs with www: {legit_raw[legit_raw.url.str.contains('www.')].shape[0]}")
