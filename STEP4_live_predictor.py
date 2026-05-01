# ============================================================
#  STEP 4 — LIVE PREDICTOR
#  Run this after training the model (STEP3)
#  It reads your sensors in real time and shows risk score
#
#  Run:
#    python STEP4_live_predictor.py
# ============================================================

import serial
import joblib
import numpy as np
import time
import os
import json
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# ── CONFIGURATION ──────────────────────────────────────────
COM_PORT   = "COM6"   # ← CHANGE THIS to your port
BAUD_RATE  = 9600
MODEL_FILE = "disaster_model.pkl"
LOG_FILE   = "sensor_log.csv"
API_HOST   = "127.0.0.1"
API_PORT   = 5001

# Flood hard-threshold (backup rule, no ML needed)
FLOOD_WARN_CM  = 90    # ← match your Arduino config
FLOOD_CRIT_CM  = 120   # ← match your Arduino config

# Tilt hard-threshold
TILT_THRESHOLD = 15.0  # degrees

# ── ALL SENSOR COLUMNS (from Arduino) ─────────────────────
ALL_COLS = [
    "tilt_x", "tilt_y", "tilt_z",
    "gyro_x", "gyro_y", "gyro_z",
    "tilt_angle",
    "temp_dht", "humidity",
    "temp_bmp", "pressure",
    "soil_pct", "water_pct", "rain_pct",
    "mq2_raw",
    "ultrasonic_cm", "water_height_cm", "water_height_pct",
    "tilt_alert", "flood_alert"
]

# ── LOAD MODEL ────────────────────────────────────────────
if not os.path.exists(MODEL_FILE):
    print("ERROR: disaster_model.pkl not found.")
    print("Run STEP3_train_model.py first.")
    exit(1)

pkg     = joblib.load(MODEL_FILE)
model   = pkg["model"]
scaler  = pkg["scaler"]
FEAT    = pkg["features"]
LABEL_NAMES = pkg.get("label_names", ['SAFE', 'FLOOD', 'LANDSLIDE', 'FLOOD+LANDSLIDE'])
THRESHOLDS = pkg.get("thresholds", {
    "landslide_tilt": 15.0,
    "flood_water_cm": 80.0,
    "flood_water_pct": 50.0
})
print(f"✅ Model loaded (trained on {pkg['rows_used']} rows)")
print(f"   Model Accuracy: {pkg.get('accuracy', 'N/A')}%")
print(f"   Trained: {pkg['trained_on'][:10]}\n")

# ── CONNECT ───────────────────────────────────────────────
print(f"Connecting to {COM_PORT}...")
try:
    ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=10)
    time.sleep(2)
    print("Connected!\n")
    source_mode = "live"
except Exception as e:
    print(f"WARNING: {e}")
    print("Running in mock mode so the dashboard can still receive ML predictions.\n")
    ser = None
    source_mode = "mock"

# Initialize latest_prediction after source_mode is determined
latest_prediction = {
    "status": "ok" if source_mode == "live" else "mock",
    "mode": source_mode,
    "risk_score": 0,
    "risk_level": "SAFE",
    "prediction": "SAFE",
    "flood_probability": 0.0,
    "landslide_probability": 0.0,
    "alerts": [],
    "reading": {},
    "timestamp": datetime.now().isoformat()
}

def mock_reading():
    """Generate mock sensor data for testing when serial port unavailable"""
    return {
        "tilt_x": -776.0,
        "tilt_y": 192.0,
        "tilt_z": 15320.0,
        "gyro_x": -27.0,
        "gyro_y": -366.0,
        "gyro_z": -68.0,
        "tilt_angle": 18.0,
        "temp_dht": 30.1,
        "humidity": 77.0,
        "temp_bmp": 30.3,
        "pressure": 1013.9,
        "soil_pct": 0.0,
        "water_pct": 6.0,
        "rain_pct": 0.0,
        "mq2_raw": 0.0,
        "ultrasonic_cm": 0.0,
        "water_height_cm": 0.0,
        "water_height_pct": 6.0,
        "tilt_alert": 1.0,
        "flood_alert": 0.0
    }

# ── HELPER: get flood and landslide probabilities ───────────
def get_disaster_probabilities(X_scaled):
    """
    Use RandomForest to get probability of each class.
    Returns: (flood_prob, landslide_prob)
    
    Classes depend on training data:
    - If 3 classes: 0=SAFE, 1=FLOOD, 2=LANDSLIDE
    - If 4 classes: 0=SAFE, 1=FLOOD, 2=LANDSLIDE, 3=BOTH
    """
    pred_proba = model.predict_proba(X_scaled)[0]  # shape: varies based on classes
    
    # Get number of classes
    n_classes = len(pred_proba)
    
    if n_classes == 3:
        # Classes: 0=SAFE, 1=FLOOD, 2=LANDSLIDE
        flood_prob = pred_proba[1] * 100        # FLOOD class
        landslide_prob = pred_proba[2] * 100    # LANDSLIDE class
    elif n_classes == 4:
        # Classes: 0=SAFE, 1=FLOOD, 2=LANDSLIDE, 3=BOTH
        flood_prob = (pred_proba[1] + pred_proba[3]) * 100     # FLOOD + BOTH
        landslide_prob = (pred_proba[2] + pred_proba[3]) * 100 # LANDSLIDE + BOTH
    else:
        # Fallback for unexpected number of classes
        flood_prob = pred_proba[1] * 100 if n_classes > 1 else 0
        landslide_prob = pred_proba[2] * 100 if n_classes > 2 else 0
    
    return flood_prob, landslide_prob

# ── HELPER: risk score from probabilities ───────────────────
def get_risk_score(flood_prob, landslide_prob):
    """
    Combined risk score (0-100)
    Takes highest probability and boosts if both are significant
    """
    max_prob = max(flood_prob, landslide_prob)
    
    # If both disasters likely, boost score
    if flood_prob > 30 and landslide_prob > 30:
        return min(100, max_prob + 15)
    
    return min(100, int(max_prob))

# ── HELPER: risk bar visual ───────────────────────────────
def risk_bar(score):
    filled = score // 5
    bar    = "█" * filled + "░" * (20 - filled)
    return f"[{bar}]"

def set_latest_prediction(reading, flood_prob, landslide_prob, alerts):
    global latest_prediction
    
    risk = get_risk_score(flood_prob, landslide_prob)
    
    # Determine prediction: which disaster is most likely?
    if flood_prob > landslide_prob and flood_prob > 40:
        prediction = "FLOOD"
    elif landslide_prob > flood_prob and landslide_prob > 40:
        prediction = "LANDSLIDE"
    elif flood_prob > 40 and landslide_prob > 40:
        prediction = "FLOOD + LANDSLIDE"
    else:
        prediction = "SAFE"
    
    risk_level = "CRITICAL" if risk > 80 else "WARNING" if risk > 50 else "SAFE"
    
    latest_prediction = {
        "status": "ok" if source_mode == "live" else "mock",
        "mode": source_mode,
        "risk_score": int(risk),
        "risk_level": risk_level,
        "prediction": prediction,
        "flood_probability": round(flood_prob, 1),
        "landslide_probability": round(landslide_prob, 1),
        "alerts": alerts,
        "reading": reading,
        "timestamp": datetime.now().isoformat()
    }

class PredictionHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path not in ("/api/prediction", "/api/prediction/latest"):
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "not found"}).encode("utf-8"))
            return

        payload = json.dumps(latest_prediction).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        # Suppress default logging (too verbose)
        return

def start_api_server():
    server = ThreadingHTTPServer((API_HOST, API_PORT), PredictionHandler)
    print(f"Prediction API: http://{API_HOST}:{API_PORT}/api/prediction")
    server.serve_forever()

api_thread = threading.Thread(target=start_api_server, daemon=True)
api_thread.start()

# ── HELPER: alert message ─────────────────────────────────
def get_alert(reading, flood_prob, landslide_prob):
    """
    Generate alerts based on ML probabilities + hard rules
    Returns list of alert messages
    """
    alerts = []

    # ─── LANDSLIDE DETECTION ───
    tilt_angle = abs(reading.get("tilt_angle", 0))
    
    if tilt_angle > TILT_THRESHOLD:
        alerts.append(f"⛰️ LANDSLIDE CRITICAL — tilt angle {tilt_angle:.1f}° exceeds threshold ({TILT_THRESHOLD}°)")
    elif landslide_prob > 70:
        alerts.append(f"⛰️ LANDSLIDE WARNING — ML model predicts {landslide_prob:.0f}% probability")
    elif landslide_prob > 40:
        alerts.append(f"⛰️ Landslide risk elevated ({landslide_prob:.0f}% probability) — monitor tilt")

    # ─── FLOOD DETECTION ───
    water_cm = reading.get("water_height_cm", -1)
    water_pct = reading.get("water_height_pct", 0)
    
    if water_cm >= FLOOD_CRIT_CM:
        alerts.append(f"🌊 FLOOD CRITICAL — water at {water_cm:.0f}cm (critical threshold: {FLOOD_CRIT_CM}cm)")
    elif water_cm >= FLOOD_WARN_CM:
        alerts.append(f"🌊 FLOOD WARNING — water at {water_cm:.0f}cm (warning threshold: {FLOOD_WARN_CM}cm)")
    elif flood_prob > 70:
        alerts.append(f"🌊 FLOOD CRITICAL — ML model predicts {flood_prob:.0f}% probability")
    elif flood_prob > 40:
        alerts.append(f"🌊 Flood risk elevated ({flood_prob:.0f}% probability) — monitor water level")

    # ─── COMBINED THREAT ───
    if len(alerts) > 1:
        alerts.insert(0, "🔴 MULTIPLE THREATS DETECTED — Immediate action required!")

    return alerts

# ── MAIN LOOP ─────────────────────────────────────────────
print("Live prediction active — press Ctrl+C to stop")
print("=" * 70)

# Validate configuration
print(f"\n📋 Configuration:")
print(f"   Model features: {len(FEAT)}")
print(f"   Features: {FEAT}")
print(f"   Sensor columns: {len(ALL_COLS)}")
print(f"   Running in: {source_mode.upper()} mode")
print(f"   Data file: {LOG_FILE}")
print(f"   API endpoint: http://{API_HOST}:{API_PORT}/api/prediction/latest\n")

# Test one prediction cycle to catch errors early
print("🔧 Testing prediction pipeline...")
try:
    test_reading = mock_reading()
    feat_vals = [test_reading.get(col, 0) for col in FEAT]
    X_test = np.array([feat_vals])
    X_test_scaled = scaler.transform(X_test)
    test_pred = model.predict(X_test_scaled)
    test_proba = model.predict_proba(X_test_scaled)
    print(f"   ✅ Prediction works! (classes: {test_pred}, proba shape: {test_proba.shape})\n")
except Exception as test_err:
    print(f"   ❌ Prediction test failed: {test_err}")
    print(f"   Terminating...\n")
    exit(1)

import csv as _csv
log_f  = open(LOG_FILE, "a", newline="")
writer = _csv.writer(log_f)

print("=" * 70 + "\n")

while True:
    try:
        if ser is None:
            reading = mock_reading()
            values = [reading[col] for col in ALL_COLS]
            time.sleep(2)
        else:
            raw = ser.readline().decode("utf-8", errors="ignore").strip()

            if not raw or raw.startswith("tilt_x") or raw.startswith("ERROR"):
                continue

            parts = raw.split(",")
            if len(parts) != len(ALL_COLS):
                continue

            values = [float(p) for p in parts]
            reading = dict(zip(ALL_COLS, values))
        timestamp = datetime.now().isoformat()

        # Save to CSV log
        writer.writerow([timestamp] + values)
        log_f.flush()

        # Build feature vector for ML
        feat_vals = []
        for col in FEAT:
            v = reading.get(col, 0)
            if v == -1:
                v = 0   # replace sensor error with 0
            feat_vals.append(v)

        X_new    = np.array([feat_vals])
        X_scaled = scaler.transform(X_new)
        
        # Get predictions from RandomForest classifier
        try:
            prediction_label = model.predict(X_scaled)[0]  # 0=SAFE, 1=FLOOD, 2=LANDSLIDE, 3=BOTH
            flood_prob, landslide_prob = get_disaster_probabilities(X_scaled)
            risk = get_risk_score(flood_prob, landslide_prob)

            # Get any alerts
            alerts = get_alert(reading, flood_prob, landslide_prob)
            set_latest_prediction(reading, flood_prob, landslide_prob, alerts)

            # Print summary line
            now   = datetime.now().strftime("%H:%M:%S")
            level = "🔴 CRITICAL" if risk > 80 else "🟡 WARNING" if risk > 50 else "🟢 SAFE"
            
            # Risk bar visualization
            filled = risk // 5
            bar = "█" * filled + "░" * (20 - filled)
            risk_bar_visual = f"[{bar}]"

            print(f"\n[{now}]  {risk_bar_visual} {risk:3d}/100  {level}")
            print(f"  💧 Flood: {flood_prob:5.1f}% prob  |  ⛰️  Landslide: {landslide_prob:5.1f}% prob")
            print(f"  🌡️  Tilt: {reading['tilt_angle']:+.1f}°  "
                  f"💧 Water: {reading['water_height_cm']:.0f}cm ({reading['water_height_pct']:.0f}%)  "
                  f"🌱 Soil: {reading['soil_pct']:.0f}%  "
                  f"🌧️  Rain: {reading['rain_pct']:.0f}%")

            if alerts:
                print()
                for a in alerts:
                    print(f"  {a}")
        
        except Exception as pred_error:
            print(f"❌ Prediction error: {pred_error}")
            print(f"   Features: {len(feat_vals)}, Expected: {len(FEAT)}")
            print(f"   Feature names: {FEAT}")
            time.sleep(1)
            continue

    except KeyboardInterrupt:
        print("\n\nStopped.")
        log_f.close()
        if ser is not None:
            ser.close()
        break
    except ValueError as ve:
        print(f"⚠️ Value error: {ve}")
        time.sleep(1)
        continue
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        time.sleep(2)
