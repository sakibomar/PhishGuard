import pandas as pd
df = pd.read_csv("data/raw_urls.csv")
print("Label=1 count:", (df.label==1).sum())
print("Label=0 count:", (df.label==0).sum())
print()
print("Label=1 samples (should be phishing):")
for u in df[df.label==1].head(10).url.tolist():
    print(f"  {u}")
print()
print("Label=0 samples (should be legit):")
for u in df[df.label==0].head(10).url.tolist():
    print(f"  {u}")
