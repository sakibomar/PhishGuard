import csv

rows = list(csv.DictReader(open("tests/test_100_types_results.csv")))
legit = [r for r in rows if r["expected"] == "LEGIT"]
phish = [r for r in rows if r["expected"] == "PHISH"]
fp = [r for r in legit if r["correct"] == "False"]
fn = [r for r in phish if r["correct"] == "False"]

print(f"LEGIT total: {len(legit)}, FALSE POSITIVES: {len(fp)} ({len(fp)/len(legit)*100:.1f}%)")
print(f"PHISH total: {len(phish)}, FALSE NEGATIVES: {len(fn)} ({len(fn)/len(phish)*100:.1f}%)")

print("\n=== FALSE POSITIVES BY CATEGORY ===")
cats = {}
for r in fp:
    cats.setdefault(r["category"], []).append(r)
for cat in sorted(cats, key=lambda c: -len(cats[c])):
    items = cats[cat]
    print(f"  {cat:30s} {len(items):>3d} FPs")
    for item in items[:2]:
        print(f"    RF={item['rf_score']:>6s}  {item['url'][:75]}")

print("\n=== PASSING CATEGORIES (0 FPs) ===")
all_cats = {}
for r in legit:
    all_cats.setdefault(r["category"], {"pass": 0, "fail": 0})
    if r["correct"] == "True":
        all_cats[r["category"]]["pass"] += 1
    else:
        all_cats[r["category"]]["fail"] += 1

for cat in sorted(all_cats):
    if all_cats[cat]["fail"] == 0:
        print(f"  ✓ {cat:30s} {all_cats[cat]['pass']:>2d}/{all_cats[cat]['pass']:>2d}")
