# 🌩️ Weather & Disaster Monitoring IoT System

> A real-time IoT-based system that detects environmental hazards — floods, earthquakes, landslides, gas leaks — and alerts people instantly.

---

## 📌 Problem Statement

Natural disasters like floods, landslides, earthquakes, and gas leaks can occur suddenly.

- Many areas lack real-time monitoring systems, which leads to delayed response and higher risk.
- So, we designed a smart system that continuously monitors environmental conditions and sends instant alerts.

---

## 🧭 Introduction

This is a real-time **Weather and Disaster Monitoring Prototype**.

- **Purpose:** detect environmental hazards — floods, earthquakes, landslides, gas leaks — and alert people instantly
- The system uses **IoT hardware**, a **web dashboard**, **AI**, **Telegram notifications**, and **machine learning with RAG chatbot**

---

## 🏗️ System Architecture

```
9 Sensors → ESP32 (Microcontroller) → Node.js Server → Web Dashboard
                                                      → Telegram Bot
                                                      → ML Pipeline
                                                      → AI RAG Chatbot
```

---

## 🔌 Microcontroller

All nine sensors feed their data into the microcontroller — we're using an **Arduino or ESP32**. It reads all sensor values in real time, processes that data, and decides when to trigger an alert. It's the brain of the system.

- All 9 sensors are connected to the ESP32
- ESP32 reads all sensor values every **2.5 seconds**
- It sends the data to the server via **HTTP POST request**

---

## 🌡️ Sensor Layer

The system uses **nine sensors** grouped into three categories:

### Weather Sensors
| Sensor | Purpose |
|--------|---------|
| DHT11 | Measures temperature and humidity |
| BMP280 | Measures atmospheric pressure |
| Soil Moisture Sensor | Monitors ground saturation (landslide risk) |
| Rain Sensor | Detects rainfall |

### Flood Sensors
| Sensor | Purpose |
|--------|---------|
| Water Level Sensor | Detects rising water |
| Ultrasonic Sensor | Measures water distance and depth for precise flood monitoring |

### Disaster Sensors
| Sensor | Purpose |
|--------|---------|
| MQ2 Gas Sensor | Detects air pollution and dangerous gas leaks |
| MPU-6050 Accelerometer | Detects ground vibrations for earthquake alerts |
| Tilt Sensor | Detects angular changes in ground for landslide detection |

### Alert Behavior
All sensors continuously collect data. The system sends data to the dashboard in real time. If any abnormal condition is detected:

- ⚠️ Alerts are shown on the dashboard
- 🔔 Buzzer is activated:
  - **Landslide** → 2 beeps
  - **Earthquake** → 5 beeps
- 📲 Notification is sent via Telegram bot

---

## 📊 The Dashboard

Our custom-built real-time dashboard shows:

- Live charts for temperature, humidity, pressure, altitude, water level, air quality
- Tilt and earthquake status indicators (green/red)
- Alert history log with timestamps
- A **"Send to Telegram"** button — sends a full sensor report instantly
- A built-in **AI disaster chatbot** (powered by Google Gemini)
- A **simulation panel** — lets us artificially trigger flood, earthquake, or landslide to demo the system without real events

If a disaster is detected — a tilt, an earthquake, or a flood — a visual alert banner appears immediately on the dashboard. There are also charts and graphs showing historical trends.

---

## 🖥️ The Server: Node.js Backend

- Runs on **port 3001** using **Node.js and Express**
- Receives sensor data from ESP32
- Stores all readings in memory
- Detects alert conditions (tilt, earthquake, flood thresholds)
- Serves the web dashboard to the browser
- Forwards alerts to Telegram

---

## 📲 Telegram Alert System

The Telegram bot gives us remote monitoring capability. Two things trigger a Telegram message automatically: any disaster event, or when the Send button on the dashboard is pressed. This means emergency responders or family members can be notified instantly, wherever they are.

When a disaster is detected, the system automatically sends a message to the Telegram bot:

- 🌍 **Earthquake detected** → message with "Drop, Cover, Hold On" instructions + all sensor readings
- ⛰️ **Landslide detected** → message with evacuation steps
- 📋 **Manual button** → sends a full formatted sensor data report with emojis

---

## 🤖 AI Chatbot (RAG System)

- Built using **Retrieval-Augmented Generation (RAG)**
- Has a knowledge base of **58+ chunks** covering: floods, earthquakes, landslides, heat stroke, gas hazards, cyclones, monsoons, Sri Lanka emergency hotlines
- User types a question → system finds relevant knowledge → sends to **Gemini 2.0 Flash API** → displays answer with sources cited
- If Gemini is offline, falls back to local responses automatically

---

## 🧠 Machine Learning Pipeline (Python)

Three-step pipeline:

1. **Log** — sensor data continuously saved to CSV file
2. **Train** — scikit-learn model trained on historical data
3. **Predict** — real-time disaster risk scores (flood risk %, earthquake probability %)

---

## 🎮 Simulation Module

Since we can't wait for a real earthquake or landslide in the lab, this module lets us artificially trigger the tilt sensor, accelerometer, and water level sensor. This is extremely useful for testing and demonstrating the alert pipeline.

---

## 🗺️ Future Work: Safe Route Planning

The most exciting part of our roadmap is a **safe route planning feature for Sri Lanka**. We plan to:

- Mark on a map all historically known flood-prone and landslide-prone areas across the island
- When a user wants to travel to a destination, the system will check if their planned route passes through any active disaster zones
- If it does, they'll receive an alert and be shown a safer alternate route

This is essentially a **disaster-aware navigation system** designed for Sri Lanka's specific geography.

---

## ⚠️ Limitations

### On the ML / Dataset
- We manually collected and labeled approximately **600 samples** ourselves
- This is sufficient for a proof-of-concept, but not for a production-grade model
- A real deployment would require thousands of samples collected over extended periods across multiple locations
- Our focus for this version was on the sensor integration, alerting pipeline, and dashboard — ML was intentionally kept minimal

### On Sensor Accuracy
- The sensors used (DHT11, MQ2, etc.) are **consumer-grade, low-cost sensors**
- They provide indicative readings suitable for a prototype, but have limitations in precision and calibration
- For example, DHT11 has **±2°C temperature accuracy** — fine for general monitoring, not for scientific-grade measurement
- In a production system, we would upgrade to industrial-grade sensors with proper calibration

### On the Overall Scope
- This is an **MVP — Minimum Viable Prototype**
- The goal was to demonstrate that the concept works end-to-end: sensors → server → dashboard → AI → alerts
- We proved the architecture is viable. The next phase would involve better hardware, larger datasets, and field testing

| Limitation | Detail |
|------------|--------|
| Dataset | ~600 manually labeled samples — sufficient for MVP, not production |
| Sensor accuracy | Consumer-grade hardware used for cost and accessibility |
| ML model | Basic classifier trained on limited data, not field-validated |
| Data collection | No real-time data collection pipeline deployed in the field |
| Testing | Simulation was used in place of live disaster data |

---

## ✅ What This MVP Successfully Demonstrates

- ✔️ Full system integration works end-to-end
- ✔️ Alert pipeline is functional and reliable
- ✔️ Dashboard and AI chatbot are production-quality
- ✔️ Architecture is ready to scale with better data and hardware
