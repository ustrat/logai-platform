import os
import glob
import pandas as pd

# Source folder
folder = r"C:\Users\Camir Inshiqaq\OneDrive\Documents\renewalguard_daily_us_separate_events"

# Output file
output_file = os.path.join(folder, "merged_all.csv")

# Find all CSV files
csv_files = glob.glob(os.path.join(folder, "*.csv"))

if not csv_files:
    print("No CSV files found in the folder.")
else:
    print(f"Found {len(csv_files)} CSV files. Merging...")

    dfs = []
    for f in csv_files:
        try:
            df = pd.read_csv(f)
            df["_source_file"] = os.path.basename(f)  # optional: track source
            dfs.append(df)
            print(f"  ✓ {os.path.basename(f)} — {len(df)} rows")
        except Exception as e:
            print(f"  ✗ {os.path.basename(f)} — ERROR: {e}")

    merged = pd.concat(dfs, ignore_index=True)
    merged.to_csv(output_file, index=False)

    print(f"\nDone! {len(merged)} total rows saved to:\n{output_file}")
