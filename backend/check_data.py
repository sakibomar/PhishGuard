import pandas as pd

d = pd.read_csv('data/raw_urls.csv')
legit = d[d.label == 0]
phish = d[d.label == 1]

print("=== LEGIT URL SAMPLES ===")
for u in legit.url.sample(15, random_state=42):
    print(f"  {u}")

print(f"\nLegit count: {len(legit)}")
print(f"Legit mean URL len: {legit.url.str.len().mean():.1f}")
print(f"Legit median URL len: {legit.url.str.len().median():.1f}")
print(f"Legit max URL len: {legit.url.str.len().max()}")

print("\n=== PHISH URL SAMPLES ===")
for u in phish.url.sample(15, random_state=42):
    print(f"  {u}")

print(f"\nPhish count: {len(phish)}")
print(f"Phish mean URL len: {phish.url.str.len().mean():.1f}")
print(f"Phish median URL len: {phish.url.str.len().median():.1f}")

# Check if legit URLs have paths
legit_has_path = legit.url.apply(lambda u: len(u.split('/')) > 3).sum()
print(f"\nLegit with path beyond domain: {legit_has_path} / {len(legit)} ({legit_has_path/len(legit)*100:.1f}%)")

phish_has_path = phish.url.apply(lambda u: len(u.split('/')) > 3).sum()
print(f"Phish with path beyond domain: {phish_has_path} / {len(phish)} ({phish_has_path/len(phish)*100:.1f}%)")
