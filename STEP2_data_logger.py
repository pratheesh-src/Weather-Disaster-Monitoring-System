# ============================================================
#  STEP 2 — DATA LOGGER
#  Run this first. It reads your ESP32 over USB and saves
#  every sensor reading to sensor_log.csv
#
#  Install first:
#    pip install pyserial pandas
#
#  Run:
#    python STEP2_data_logger.py
# ============================================================

import serial
import csv
import os
import time
from datetime import datetime

# ── CONFIGURATION ──────────────────────────────────────────
# Find your port:
#   Raspberry Pi / Linux:  ls /dev/tty*  → usually /dev/ttyUSB0
#   Mac:                   ls /dev/tty*  → usually /dev/tty.usbserial-*
#   Windows:               Device Manager → COM ports → e.g. COM3

COM_PORT  = "COM6"    # ← CHANGE THIS to your port
BAUD_RATE = 9600
LOG_FILE  = "sensor_log.csv"

COLUMNS = [
    "timestamp",
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

# ── CREATE LOG FILE ────────────────────────────────────────
file_exists = os.path.exists(LOG_FILE)
log_f = open(LOG_FILE, "a", newline="")
writer = csv.writer(log_f)

if not file_exists:
    writer.writerow(COLUMNS)
    log_f.flush()
    print(f"Created new log file: {LOG_FILE}")
else:
    # count existing rows
    with open(LOG_FILE) as f:
        existing = sum(1 for _ in f) - 1
    print(f"Appending to existing log ({existing} rows already collected)")

# ── CONNECT TO ESP32 ───────────────────────────────────────
print(f"\nConnecting to {COM_PORT}...")
try:
    ser = serial.Serial(COM_PORT, BAUD_RATE, timeout=10)
    time.sleep(2)   # wait for ESP32 to boot
    print("Connected!\n")
except Exception as e:
    print(f"\nERROR: Could not connect to {COM_PORT}")
    print(f"Details: {e}")
    print("\nTry one of these ports:")
    import glob
    ports = glob.glob("/dev/tty*") + glob.glob("COM*")
    for p in ports:
        print(f"  {p}")
    exit(1)

# ── MAIN LOGGING LOOP ──────────────────────────────────────
row_count = 0
print("Logging sensor data — press Ctrl+C to stop\n")
print(f"{'Time':12} | {'Rows':6} | {'Tilt°':7} | {'Water%':7} | "
      f"{'Humidity':9} | {'Pressure':9} | Status")
print("-" * 75)

while True:
    try:
        raw = ser.readline().decode("utf-8", errors="ignore").strip()

        # skip blank lines and the header line from Arduino
        if not raw or raw.startswith("tilt_x") or raw.startswith("ERROR"):
            if raw.startswith("ERROR"):
                print(f"Arduino says: {raw}")
            continue

        parts = raw.split(",")
        if len(parts) != len(COLUMNS) - 1:   # -1 because timestamp added here
            continue  # malformed line, skip

        values = [float(p) for p in parts]
        timestamp = datetime.now().isoformat()
        writer.writerow([timestamp] + values)
        log_f.flush()
        row_count += 1

        # pretty print summary every row
        tilt_angle    = values[6]
        water_h_pct   = values[17]
        humidity      = values[8]
        pressure      = values[10]
        tilt_alert    = int(values[18])
        flood_alert   = int(values[19])

        status = "OK"
        if tilt_alert:  status = "TILT ALERT"
        if flood_alert == 1: status = "FLOOD WARNING"
        if flood_alert == 2: status = "FLOOD CRITICAL"

        now = datetime.now().strftime("%H:%M:%S")
        print(f"{now:12} | {row_count:6} | {tilt_angle:+6.1f}° | "
              f"{water_h_pct:6.1f}% | {humidity:7.1f}%  | "
              f"{pressure:7.1f}hPa | {status}")

        # Milestone messages
        if row_count == 100:
            print("\n  ✓ 100 rows — still collecting baseline...\n")
        elif row_count == 500:
            print("\n  ✓ 500 rows — ready to train! Run STEP3_train_model.py\n")
        elif row_count == 2880:
            print("\n  ✓ 2880 rows (2 days) — great dataset! Retrain for best results.\n")

    except KeyboardInterrupt:
        print(f"\n\nStopped. Total rows logged: {row_count}")
        print(f"Data saved to: {LOG_FILE}")
        print("\nNext step: run  python STEP3_train_model.py")
        log_f.close()
        ser.close()
        break
    except ValueError:
        continue   # skip lines with non-numeric data
    except Exception as e:
        print(f"Error: {e} — retrying...")
        time.sleep(2)
