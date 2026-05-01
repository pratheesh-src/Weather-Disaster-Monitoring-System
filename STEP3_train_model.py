# ============================================================
#  STEP 3 — TRAIN THE MODEL (FLOOD & LANDSLIDE CLASSIFIER)
#  Run this after collecting 500+ rows (about 4 hours)
#  Run again after 2 days for best accuracy
#
#  Install first:
#    pip install scikit-learn pandas numpy joblib
#
#  Run:
#    python STEP3_train_model.py
# ============================================================

import pandas as pd
import numpy as np
import joblib
import os
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from datetime import datetime

LOG_FILE   = "sensor_log.csv"
MODEL_FILE = "disaster_model.pkl"

# ─── DISASTER THRESHOLDS (for auto-labeling training data) ───
LANDSLIDE_TILT_THRESHOLD = 15.0     # degrees — tilt > 15° = landslide
FLOOD_WATER_CM_THRESHOLD = 80.0     # cm — water > 80cm = flood
FLOOD_WATER_PCT_THRESHOLD = 50.0    # % — water > 50% = flood risk

# ── CHECK DATA FILE ────────────────────────────────────────
if not os.path.exists(LOG_FILE):
    print("ERROR: sensor_log.csv not found.")
    print("Run STEP2_data_logger.py first to collect data.")
    exit(1)

# ── LOAD DATA ──────────────────────────────────────────────
print("Loading data...")
df = pd.read_csv(LOG_FILE)
print(f"  Rows loaded: {len(df)}")

if len(df) < 100:
    print(f"\nWARNING: Only {len(df)} rows — need at least 500 for good results.")
    print("Keep STEP2_data_logger.py running and try again later.")
    exit(1)

if len(df) < 500:
    print(f"\nWARNING: Only {len(df)} rows. Model will work but 500+ is better.")
    print("Continuing anyway...\n")

# ── SELECT FEATURES ────────────────────────────────────────
# These sensors best predict flood and landslide
FEATURE_COLS = [
    "tilt_x", "tilt_y", "tilt_z",
    "gyro_x", "gyro_y", "gyro_z",
    "tilt_angle",
    "temp_dht", "humidity",
    "pressure",
    "soil_pct", "rain_pct", "water_pct",
    "water_height_cm", "water_height_pct",
    "mq2_raw"
]

# Keep only columns that exist in the data
FEATURE_COLS = [c for c in FEATURE_COLS if c in df.columns]
print(f"  Features used: {len(FEATURE_COLS)}")
print(f"    {FEATURE_COLS}\n")

X = df[FEATURE_COLS].copy()

# ── CLEAN DATA ─────────────────────────────────────────────
# Replace -1 (sensor error) with median value
for col in X.columns:
    median = X[col][X[col] != -1].median()
    X[col] = X[col].replace(-1, median)

X = X.dropna()
print(f"  Clean rows:   {len(X)}\n")

# ── AUTO-LABEL TRAINING DATA (Flood or Landslide) ──────────
print("Creating training labels based on sensor thresholds...")
print(f"  Landslide threshold: tilt_angle > {LANDSLIDE_TILT_THRESHOLD}°")
print(f"  Flood threshold:     water_height_cm > {FLOOD_WATER_CM_THRESHOLD}cm OR water_height_pct > {FLOOD_WATER_PCT_THRESHOLD}%\n")

y = np.zeros(len(X), dtype=int)  # 0 = SAFE, 1 = FLOOD, 2 = LANDSLIDE, 3 = FLOOD+LANDSLIDE

landslide_count = 0
flood_count = 0
safe_count = 0

for idx in X.index:
    tilt = abs(X.loc[idx, 'tilt_angle'])
    water_cm = X.loc[idx, 'water_height_cm']
    water_pct = X.loc[idx, 'water_height_pct']
    
    is_landslide = tilt > LANDSLIDE_TILT_THRESHOLD
    is_flood = (water_cm > FLOOD_WATER_CM_THRESHOLD) or (water_pct > FLOOD_WATER_PCT_THRESHOLD)
    
    if is_landslide and is_flood:
        y[X.index.get_loc(idx)] = 3  # Both
    elif is_landslide:
        y[X.index.get_loc(idx)] = 2  # Landslide only
        landslide_count += 1
    elif is_flood:
        y[X.index.get_loc(idx)] = 1  # Flood only
        flood_count += 1
    else:
        y[X.index.get_loc(idx)] = 0  # Safe
        safe_count += 1

print(f"Training data distribution:")
print(f"  🟢 SAFE:            {safe_count:,} ({safe_count/len(X)*100:.1f}%)")
print(f"  🌊 FLOOD:           {flood_count:,} ({flood_count/len(X)*100:.1f}%)")
print(f"  ⛰️  LANDSLIDE:       {landslide_count:,} ({landslide_count/len(X)*100:.1f}%)")
print(f"  🔴 FLOOD+LANDSLIDE: {(y==3).sum():,} ({(y==3).sum()/len(X)*100:.1f}%)\n")

# ── SCALE FEATURES ─────────────────────────────────────────
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

# ── TRAIN RANDOM FOREST CLASSIFIER ──────────────────────────
print("Training Random Forest Classifier (Flood & Landslide)...")
model = RandomForestClassifier(
    n_estimators=300,           # 300 trees for better accuracy
    max_depth=15,               # prevent overfitting
    min_samples_split=10,       # at least 10 samples per split
    min_samples_leaf=5,         # at least 5 samples per leaf
    random_state=42,
    n_jobs=-1,                  # use all CPU cores
    class_weight='balanced'      # handle class imbalance
)
model.fit(X_scaled, y)
print("  Training complete!\n")

# ── FEATURE IMPORTANCE ──────────────────────────────────────
print("Top 5 important features for prediction:")
importances = model.feature_importances_
top_indices = np.argsort(importances)[-5:][::-1]
for rank, idx in enumerate(top_indices, 1):
    print(f"  {rank}. {FEATURE_COLS[idx]:20s} — {importances[idx]*100:6.2f}%")
print()

# ── SELF-TEST ────────────────────────────────────────────────
print("Model accuracy on training data:")
predictions = model.predict(X_scaled)
accuracy = (predictions == y).sum() / len(y) * 100
print(f"  Overall accuracy: {accuracy:.1f}%\n")

label_names = ['SAFE', 'FLOOD', 'LANDSLIDE', 'FLOOD+LANDSLIDE']
unique_classes = np.unique(y)
actual_label_names = [label_names[i] for i in unique_classes]
print(classification_report(y, predictions, target_names=actual_label_names, zero_division=0))

# ── SAVE MODEL ────────────────────────────────────────────
package = {
    "model":        model,
    "scaler":       scaler,
    "features":     FEATURE_COLS,
    "label_names":  actual_label_names,
    "all_label_names": label_names,
    "trained_on":   datetime.now().isoformat(),
    "rows_used":    len(X),
    "accuracy":     accuracy,
    "thresholds": {
        "landslide_tilt": LANDSLIDE_TILT_THRESHOLD,
        "flood_water_cm": FLOOD_WATER_CM_THRESHOLD,
        "flood_water_pct": FLOOD_WATER_PCT_THRESHOLD
    }
}
joblib.dump(package, MODEL_FILE)
print(f"\n✅ Model saved to: {MODEL_FILE}")
print(f"   Trained on {len(X)} rows at {datetime.now().strftime('%Y-%m-%d %H:%M')}")
print(f"   Accuracy: {accuracy:.1f}%")
print(f"\nNext step: run  python STEP4_live_predictor.py")
