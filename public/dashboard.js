let mpuChart;
let ultrasonicChart;
const ultrasonicHistory = { labels: [], data: [] };
const MAX_HISTORY = 60;
const predictionApiUrl = "/api/prediction/latest";  // Backend proxy (safe - no external URLs exposed)

const MPU_SHAKE_CONFIG = {
    accelDeltaThreshold: 2500,
    gyroDeltaThreshold: 800,
    holdMs: 4000
};

let previousMpuSample = null;
let mpuShakeHoldUntil = 0;
let dashboardEarthquakeActive = false;
let dashboardTiltActive = false;

// ── Track whether water level sensor has EVER responded above 5% ─────────────
// Once true, it stays true for the session. Ultrasonic unlocks permanently
// the moment the first real payload arrives with water_level percentage > 5%.
let waterSensorHasResponded = false;

const fallbackSensorData = {
    sensor_status: { dht11: true, rain: true, soil: true, ultrasonic: true, water_level: true, tilt: true, mq2: true, bmp180: true, mpu6050: true },
    dht11: { temperature: 30.1, humidity: 77.0 },
    rain: { raw: 0, percentage: 0 },
    soil: { raw: 0, percentage: 0 },
    ultrasonic: { distance: 45, enabled: false, disabled_reason: '' },
    // Fallback has NO timestamp so it does NOT count as "sensor responded"
    water_level_sensor: { raw: 0, percentage: 0, timestamp: null },
    tilt: { value: 0, state: "LEVEL" },
    mq2: { lpg: 0, propane: 0, methane: 0, hydrogen: 0, smoke: 0 },
    bmp180: { pressure: 1013.9, altitude: 32.0, temperature: 30.3 },
    mpu6050: { acceleration: { x: -776, y: 192, z: 15320 }, gyroscope: { x: -27, y: -366, z: -68 } },
    timestamp: Date.now()
};

function initializeClock() {
    const liveClock = document.getElementById("liveClock");
    if (!liveClock) return;
    const refreshClock = () => { liveClock.textContent = new Date().toLocaleTimeString(); };
    refreshClock();
    setInterval(refreshClock, 1000);
}

function initializeThemeToggle() {
    const themeToggle = document.getElementById("themeToggle");
    const currentTheme = localStorage.getItem("theme") || "dark";
    if (currentTheme === "light") {
        document.body.classList.remove("dark-mode");
        document.body.classList.add("light-mode");
    } else {
        document.body.classList.remove("light-mode");
        document.body.classList.add("dark-mode");
    }
    if (!themeToggle) return;
    themeToggle.addEventListener("click", () => {
        const isDark = document.body.classList.contains("dark-mode");
        if (isDark) {
            document.body.classList.remove("dark-mode");
            document.body.classList.add("light-mode");
            localStorage.setItem("theme", "light");
        } else {
            document.body.classList.remove("light-mode");
            document.body.classList.add("dark-mode");
            localStorage.setItem("theme", "dark");
        }
        updateChartTheme();
    });
}

function initializeMpuChart() {
    const canvas = document.getElementById("mpuChart");
    if (!canvas) return;
    mpuChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels: ["X", "Y", "Z"],
            datasets: [
                { label: "Acceleration", data: [0, 0, 0], borderColor: "#22d3ee", backgroundColor: "rgba(34, 211, 238, 0.2)", borderWidth: 2, tension: 0.3 },
                { label: "Gyroscope", data: [0, 0, 0], borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.16)", borderWidth: 2, tension: 0.3 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { legend: { labels: { color: "#c7d7ee" } } },
            scales: {
                x: { ticks: { color: "#c7d7ee" }, grid: { color: "rgba(176, 204, 239, 0.16)" } },
                y: { ticks: { color: "#c7d7ee" }, grid: { color: "rgba(176, 204, 239, 0.16)" } }
            }
        }
    });
    updateChartTheme();
}

function updateChartTheme() {
    if (!mpuChart) return;
    const isDark = document.body.classList.contains("dark-mode");
    const tickColor = isDark ? "#c7d7ee" : "#3d5e81";
    const gridColor = isDark ? "rgba(176, 204, 239, 0.16)" : "rgba(66, 119, 173, 0.16)";
    mpuChart.options.plugins.legend.labels.color = tickColor;
    mpuChart.options.scales.x.ticks.color = tickColor;
    mpuChart.options.scales.y.ticks.color = tickColor;
    mpuChart.options.scales.x.grid.color = gridColor;
    mpuChart.options.scales.y.grid.color = gridColor;
    mpuChart.update();
    if (ultrasonicChart) {
        ultrasonicChart.options.plugins.legend.labels.color = tickColor;
        ultrasonicChart.options.scales.x.ticks.color = tickColor;
        ultrasonicChart.options.scales.y.ticks.color = tickColor;
        ultrasonicChart.options.scales.x.grid.color = gridColor;
        ultrasonicChart.options.scales.y.grid.color = gridColor;
        ultrasonicChart.update();
    }
}

function initializeUltrasonicChart() {
    const canvas = document.getElementById("ultrasonicChart");
    if (!canvas) return;
    ultrasonicChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: { labels: [], datasets: [{ label: "Flood Depth (cm)", data: [], borderColor: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.1)", borderWidth: 2.5, tension: 0.4, fill: true, pointRadius: 3, pointBackgroundColor: "#ef4444", pointBorderColor: "#fff", pointBorderWidth: 1 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { labels: { color: "#c7d7ee", font: { size: 11 } } },
                tooltip: { backgroundColor: "rgba(0, 0, 0, 0.8)", titleColor: "#fff", bodyColor: "#fecaca", callbacks: { label: function(context) { return `Flood Depth: ${context.raw.toFixed(1)} cm`; } } }
            },
            scales: {
                x: { ticks: { color: "#c7d7ee", font: { size: 10 } }, grid: { color: "rgba(176, 204, 239, 0.1)" }, title: { display: true, text: "Time", color: "#c7d7ee" } },
                y: { min: 0, max: 50, ticks: { color: "#c7d7ee", font: { size: 10 } }, grid: { color: "rgba(176, 204, 239, 0.16)" }, title: { display: true, text: "Flood Depth (cm)", color: "#c7d7ee" } }
            }
        }
    });
    updateChartTheme();
}

function updateUltrasonicChart(floodDepth) {
    if (!ultrasonicChart) return;
    const now = new Date();
    const timeLabel = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    ultrasonicHistory.labels.push(timeLabel);
    ultrasonicHistory.data.push(floodDepth);
    if (ultrasonicHistory.labels.length > MAX_HISTORY) {
        ultrasonicHistory.labels.shift();
        ultrasonicHistory.data.shift();
    }
    ultrasonicChart.data.labels = ultrasonicHistory.labels;
    ultrasonicChart.data.datasets[0].data = ultrasonicHistory.data;
    ultrasonicChart.update("none");
}

function safeNumber(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function withFallbackData(incoming) {
    const source = incoming || {};
    return {
        sensor_status: { ...fallbackSensorData.sensor_status, ...(source.sensor_status || {}) },
        dht11: { temperature: safeNumber(source?.dht11?.temperature, fallbackSensorData.dht11.temperature), humidity: safeNumber(source?.dht11?.humidity, fallbackSensorData.dht11.humidity) },
        rain: { raw: safeNumber(source?.rain?.raw, fallbackSensorData.rain.raw), percentage: safeNumber(source?.rain?.percentage, fallbackSensorData.rain.percentage) },
        soil: { raw: safeNumber(source?.soil?.raw, fallbackSensorData.soil.raw), percentage: safeNumber(source?.soil?.percentage, fallbackSensorData.soil.percentage) },
        ultrasonic: {
            distance: safeNumber(source?.ultrasonic?.distance, fallbackSensorData.ultrasonic.distance),
            enabled: source?.ultrasonic?.enabled === true,
            disabled_reason: source?.ultrasonic?.disabled_reason || ''
        },
        water_level_sensor: {
            raw: safeNumber(source?.water_level_sensor?.raw, fallbackSensorData.water_level_sensor.raw),
            percentage: safeNumber(source?.water_level_sensor?.percentage, fallbackSensorData.water_level_sensor.percentage),
            // Keep the real timestamp from server, or null if this is fallback data
            timestamp: source?.water_level_sensor?.timestamp || null
        },
        tilt: { value: safeNumber(source?.tilt?.value, fallbackSensorData.tilt.value), state: source?.tilt?.state || fallbackSensorData.tilt.state },
        mq2: { lpg: safeNumber(source?.mq2?.lpg, fallbackSensorData.mq2.lpg), propane: safeNumber(source?.mq2?.propane, fallbackSensorData.mq2.propane), methane: safeNumber(source?.mq2?.methane, fallbackSensorData.mq2.methane), hydrogen: safeNumber(source?.mq2?.hydrogen, fallbackSensorData.mq2.hydrogen), smoke: safeNumber(source?.mq2?.smoke, fallbackSensorData.mq2.smoke) },
        bmp180: { pressure: safeNumber(source?.bmp180?.pressure, fallbackSensorData.bmp180.pressure), altitude: safeNumber(source?.bmp180?.altitude, fallbackSensorData.bmp180.altitude), temperature: safeNumber(source?.bmp180?.temperature, fallbackSensorData.bmp180.temperature) },
        mpu6050: { acceleration: { x: safeNumber(source?.mpu6050?.acceleration?.x, fallbackSensorData.mpu6050.acceleration.x), y: safeNumber(source?.mpu6050?.acceleration?.y, fallbackSensorData.mpu6050.acceleration.y), z: safeNumber(source?.mpu6050?.acceleration?.z, fallbackSensorData.mpu6050.acceleration.z) }, gyroscope: { x: safeNumber(source?.mpu6050?.gyroscope?.x, fallbackSensorData.mpu6050.gyroscope.x), y: safeNumber(source?.mpu6050?.gyroscope?.y, fallbackSensorData.mpu6050.gyroscope.y), z: safeNumber(source?.mpu6050?.gyroscope?.z, fallbackSensorData.mpu6050.gyroscope.z) } },
        timestamp: source.timestamp || Date.now()
    };
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
}

function setWidth(id, value) {
    const element = document.getElementById(id);
    if (element) element.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function setHeight(id, value) {
    const element = document.getElementById(id);
    if (element) element.style.height = `${Math.max(0, Math.min(100, value))}%`;
}

function applyStatus(id, connected) {
    const element = document.getElementById(id);
    if (!element) return;
    element.textContent = connected ? "CONNECTED" : "DISCONNECTED";
    element.classList.toggle("status-disconnected", !connected);
}

function updateSensorStatuses(status) {
    applyStatus("dht11Status", status.dht11);
    applyStatus("dht11TempStatus", status.dht11);
    applyStatus("dht11HumidityStatus", status.dht11);
    applyStatus("rainStatus", status.rain);
    applyStatus("soilStatus", status.soil);
    applyStatus("bmpTempStatus", status.bmp180);
    applyStatus("bmpPressureStatus", status.bmp180);
    applyStatus("tiltStatus", status.tilt);
    applyStatus("mq2Status", status.mq2);
    applyStatus("mpu6050Status", status.mpu6050);
}

function updateTopPanels(data) {
    setText("tempValue", data.dht11.temperature.toFixed(1));
    setText("tempValueMirror", data.dht11.temperature.toFixed(1));
    setText("humidityValue", data.dht11.humidity.toFixed(1));
    setText("humidityValueMirror", data.dht11.humidity.toFixed(1));
    setText("pressureValue", data.bmp180.pressure.toFixed(1));
    setText("pressureValueMirror", data.bmp180.pressure.toFixed(1));
    setText("altitudeValue", data.bmp180.altitude.toFixed(1));
    setText("altitudeValueMirror", data.bmp180.altitude.toFixed(1));
    setText("bmpTempValue", data.bmp180.temperature.toFixed(1));
    setText("bmpTempValueMirror", data.bmp180.temperature.toFixed(1));
    setText("rainValue", data.rain.percentage.toFixed(0));
    setText("soilValue", data.soil.percentage.toFixed(0));
    setWidth("tempBar", data.dht11.temperature * 2);
    setWidth("humidityBar", data.dht11.humidity);
    setWidth("rainBar", data.rain.percentage);
    setWidth("soilBar", data.soil.percentage);
    setWidth("bmpTempBar", data.bmp180.temperature * 2);
    const pressurePercent = ((data.bmp180.pressure - 900) / 200) * 100;
    setWidth("pressureBar", pressurePercent);
    const altitudePercent = Math.min(Math.abs(data.bmp180.altitude) * 2, 100);
    setWidth("altitudeBar", altitudePercent);
}

function updateWaterSystem(data) {
    const waterPercent = data.water_level_sensor.percentage;
    const waterRaw = data.water_level_sensor.raw;
    const waterTimestamp = data.water_level_sensor.timestamp;
    const ultrasonicDistance = data.ultrasonic.distance;
    const houseHeight = 45;

    // ── The ONE rule: water level sensor must have a real timestamp AND percentage > 5% ──
    // The server stamps water_level_sensor.timestamp = Date.now() on every POST
    // from the ESP32. Fallback data has timestamp = null.
    // Once we see a real timestamp with percentage > 5%, waterSensorHasResponded
    // latches to true and stays true for the rest of the session.
    if (waterTimestamp !== null && waterTimestamp > 0 && waterPercent > 5) {
        waterSensorHasResponded = true;
    }

    setHeight("waterLevelVerticalBar", waterPercent);
    setText("waterLevelSensorValue", waterPercent.toFixed(1));
    setText("waterLevelRawValue", waterRaw);
    setText("readingWaterLevel", `${waterPercent.toFixed(1)}%`);
    setWidth("waterSummaryProgress", waterPercent);

    if (!waterSensorHasResponded) {
        // ── WAITING: water level hasn't exceeded 5% yet ───────────────────────
        const waitingMsg = waterTimestamp !== null
            ? "⏳ Water level below 5% — ultrasonic on standby..."
            : "⏳ Waiting for water level sensor to respond...";
        setText("ultrasonicSensorStatus", "WAITING");
        setText("ultrasonicStatusText", waitingMsg);
        setText("ultrasonicValue", "---");
        setText("ultrasonicPercentText", "Waiting...");
        setText("ultrasonicWaterText", "---");
        setText("readingWaterHeight", "---");
        setText("readingStatus", "WAITING");
        setText("waterLevelComparisonText", waitingMsg);
        setHeight("ultrasonicWaterContainer", 0);
        return;
    }

    // ── ACTIVE: water sensor percentage > 5% — calculate flood depth ──────────
    let floodDepth = 0;
    let floodPercent = 0;
    let floodStatus = "CLEAR";
    let statusMessage = "";

    if (ultrasonicDistance <= 0) {
        floodDepth = houseHeight;
        floodPercent = 100;
        floodStatus = "CRITICAL";
        statusMessage = "🚨 SENSOR SUBMERGED - Complete flooding detected!";
    } else if (ultrasonicDistance < houseHeight) {
        floodDepth = houseHeight - ultrasonicDistance;
        floodPercent = (floodDepth / houseHeight) * 100;
        if (floodDepth >= 30) {
            floodStatus = "CRITICAL";
            statusMessage = `🚨 CRITICAL FLOOD: ${floodDepth.toFixed(1)} cm of water - EVACUATE IMMEDIATELY!`;
        } else if (floodDepth >= 15) {
            floodStatus = "WARNING";
            statusMessage = `⚠️ FLOOD WARNING: ${floodDepth.toFixed(1)} cm of water detected - take precautions!`;
        } else if (floodDepth > 0) {
            floodStatus = "MONITORING";
            statusMessage = `💧 Monitoring: ${floodDepth.toFixed(1)} cm of water detected`;
        } else {
            floodStatus = "CLEAR";
            statusMessage = "✅ No flooding detected - area is clear";
        }
    } else {
        floodStatus = "CLEAR";
        statusMessage = "✅ No flooding detected - sensor sees floor";
    }

    updateUltrasonicChart(floodDepth);

    setText("ultrasonicSensorStatus", floodStatus);
    setText("ultrasonicStatusText", statusMessage);
    setText("ultrasonicValue", floodDepth.toFixed(1));
    setText("ultrasonicPercentText", `${floodPercent.toFixed(0)}% Filled`);
    setText("ultrasonicWaterText", `${floodDepth.toFixed(1)} cm`);
    setText("readingWaterHeight", `${floodDepth.toFixed(1)} cm`);
    setHeight("ultrasonicWaterContainer", floodPercent);

    if (floodStatus === "CRITICAL") {
        setText("readingStatus", "CRITICAL");
        setText("waterLevelComparisonText", `⚠️ CRITICAL - ${floodDepth.toFixed(1)} cm of water! EVACUATE NOW!`);
    } else if (floodStatus === "WARNING") {
        setText("readingStatus", "WARNING");
        setText("waterLevelComparisonText", `⚠️ WARNING - ${floodDepth.toFixed(1)} cm of water detected!`);
    } else if (floodStatus === "MONITORING") {
        setText("readingStatus", "MONITORING");
        setText("waterLevelComparisonText", `💧 Monitoring: ${floodDepth.toFixed(1)} cm of water.`);
    } else {
        setText("readingStatus", "CLEAR");
        setText("waterLevelComparisonText", "✅ No flooding - area is safe.");
    }
}

function updateTiltCard(data) {
    const isTilted = data.tilt.state === "TILTED" || data.tilt.value === 1;
    const alertBanner = document.getElementById("alertBanner");
    const tiltValue = document.getElementById("tiltValue");
    const tiltIcon = document.getElementById("tiltIcon");
    if (tiltValue) {
        tiltValue.textContent = isTilted ? "TILTED" : "NORMAL";
        tiltValue.style.color = isTilted ? "#fecaca" : "#bbf7d0";
    }
    if (tiltIcon) tiltIcon.textContent = isTilted ? "⚠️" : "✅";
    if (alertBanner) {
        if (isTilted) {
            alertBanner.textContent = "CRITICAL: Tilt sensor indicates TILTED state. Immediate inspection required.";
            alertBanner.classList.add("show");
            if (!dashboardTiltActive) {
                console.log("[TILT] Tilt state changed to TILTED - triggering alert");
                sendDashboardEventAlert("TILT");
            }
        } else {
            alertBanner.textContent = "System stable: no critical tilt alerts active.";
            alertBanner.classList.remove("show");
            if (dashboardTiltActive) {
                console.log("[TILT] Tilt state changed to NORMAL");
            }
        }
    }
    dashboardTiltActive = isTilted;
}

function updateMq2(data) {
    setText("lpgValue", data.mq2.lpg.toFixed(0));
    setText("propaneValue", data.mq2.propane.toFixed(0));
    setText("methaneValue", data.mq2.methane.toFixed(0));
    setText("hydrogenValue", data.mq2.hydrogen.toFixed(0));
    setText("smokeValue", data.mq2.smoke.toFixed(0));
}

async function sendDashboardEventAlert(eventType) {
    try {
        console.log(`[ALERT-DISPATCH] Sending ${eventType} to server...`);
        const response = await fetch("/api/alerts/dashboard-event", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventType })
        });
        const data = await response.json();
        console.log(`[ALERT-DISPATCH] ${eventType} response:`, data);
    } catch (error) {
        console.error(`[ALERT-DISPATCH] ${eventType} send FAILED:`, error);
    }
}

function detectMpuShake(accel, gyro) {
    const currentSample = {
        accel: { x: Number(accel.x) || 0, y: Number(accel.y) || 0, z: Number(accel.z) || 0 },
        gyro: { x: Number(gyro.x) || 0, y: Number(gyro.y) || 0, z: Number(gyro.z) || 0 }
    };

    if (!previousMpuSample) {
        previousMpuSample = currentSample;
        return false;
    }

    const accelDelta = Math.abs(currentSample.accel.x - previousMpuSample.accel.x)
        + Math.abs(currentSample.accel.y - previousMpuSample.accel.y)
        + Math.abs(currentSample.accel.z - previousMpuSample.accel.z);

    const gyroDelta = Math.abs(currentSample.gyro.x - previousMpuSample.gyro.x)
        + Math.abs(currentSample.gyro.y - previousMpuSample.gyro.y)
        + Math.abs(currentSample.gyro.z - previousMpuSample.gyro.z);

    previousMpuSample = currentSample;

    const now = Date.now();
    if (accelDelta >= MPU_SHAKE_CONFIG.accelDeltaThreshold || gyroDelta >= MPU_SHAKE_CONFIG.gyroDeltaThreshold) {
        mpuShakeHoldUntil = now + MPU_SHAKE_CONFIG.holdMs;
    }

    return now < mpuShakeHoldUntil;
}

function updateMpu(data) {
    const accel = data.mpu6050.acceleration;
    const gyro = data.mpu6050.gyroscope;
    setText("accelX", accel.x);
    setText("accelY", accel.y);
    setText("accelZ", accel.z);
    setText("gyroX", gyro.x);
    setText("gyroY", gyro.y);
    setText("gyroZ", gyro.z);
    if (mpuChart) {
        mpuChart.data.datasets[0].data = [Math.abs(accel.x), Math.abs(accel.y), Math.abs(accel.z)];
        mpuChart.data.datasets[1].data = [Math.abs(gyro.x), Math.abs(gyro.y), Math.abs(gyro.z)];
        mpuChart.update();
    }

    const isShakeDetected = detectMpuShake(accel, gyro);
    const alertBanner = document.getElementById("alertBanner");
    const mpuPanelAlert = document.getElementById("mpuEarthquakeAlert");
    if (alertBanner && isShakeDetected) {
        alertBanner.textContent = "🚨 EARTHQUAKE ALERT: Strong MPU6050 shaking detected. Take immediate safety precautions.";
        alertBanner.classList.add("show");
    }

    if (mpuPanelAlert) {
        if (isShakeDetected) {
            mpuPanelAlert.textContent = "🚨 EARTHQUAKE ALERT: Strong shaking detected from MPU6050. Stay alert and move to a safe area.";
            mpuPanelAlert.classList.add("show");
        } else {
            mpuPanelAlert.classList.remove("show");
        }
    }

    if (isShakeDetected && !dashboardEarthquakeActive) {
        console.log("[EARTHQUAKE] Shake detected - triggering earthquake alert");
        sendDashboardEventAlert("EARTHQUAKE");
    }
    dashboardEarthquakeActive = isShakeDetected;
}

function getFallbackPrediction(data) {
    const waterLevel = data.water_level_sensor.percentage || 0;
    const ultrasonicDistance = data.ultrasonic.distance || 45;
    const houseHeight = 45;
    let floodDepth = 0;
    if (ultrasonicDistance < houseHeight && ultrasonicDistance > 0) floodDepth = houseHeight - ultrasonicDistance;
    else if (ultrasonicDistance <= 0) floodDepth = houseHeight;
    const floodPercent = (floodDepth / houseHeight) * 100;
    const tiltHigh = data.tilt.state === "TILTED" || data.tilt.value === 1;
    let riskScore = 0;
    if (tiltHigh) riskScore = 88;
    else if (floodDepth >= 30) riskScore = 95;
    else if (floodDepth >= 15) riskScore = 75;
    else if (waterLevel >= 70) riskScore = 70;
    else if (waterLevel >= 40) riskScore = 50;
    else if (floodDepth > 0) riskScore = 40;
    else riskScore = 24;
    const riskLevel = riskScore > 80 ? "CRITICAL" : riskScore > 50 ? "WARNING" : "SAFE";
    return { status: "fallback", mode: "fallback", risk_score: riskScore, risk_level: riskLevel, prediction: riskLevel, flood_probability: floodPercent, landslide_probability: tiltHigh ? 85 : 5 };
}

function renderPrediction(prediction) {
    const riskScore = Number(prediction?.risk_score ?? 0);
    const riskLevel = prediction?.risk_level || "SAFE";
    const modelPrediction = prediction?.prediction || prediction?.label || "SAFE";
    const floodProb = Number(prediction?.flood_probability ?? 0);
    const landslideProb = Number(prediction?.landslide_probability ?? 0);
    const mode = (prediction?.mode || prediction?.status || "fallback").toLowerCase();
    const modeText = mode === "live" || mode === "ok" ? "LIVE" : "FALLBACK";
    setText("mlStatus", modeText);
    setText("mlModeValue", modeText);
    setText("mlRiskLevel", riskLevel);
    setText("mlLabelValue", modelPrediction);
    setText("mlDecisionScore", riskScore.toFixed(0) + "%");
    const bar = document.getElementById("mlRiskBar");
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, riskScore))}%`;
    const summary = document.getElementById("mlRiskSummary");
    if (summary) {
        let summaryText = modeText === "FALLBACK" ? "Predictor API offline. Using fallback estimate." : `💧 Flood: ${floodProb.toFixed(1)}% | ⛰️ Landslide: ${landslideProb.toFixed(1)}% | `;
        summaryText += riskLevel === "CRITICAL" ? "🔴 HIGH RISK — Immediate action required!" : riskLevel === "WARNING" ? "🟡 WARNING — Elevated risk!" : "🟢 SAFE — Normal conditions.";
        summary.textContent = summaryText;
    }
}

async function fetchPrediction(data) {
    const fallbackPrediction = getFallbackPrediction(data);
    try {
        const response = await fetch(predictionApiUrl, { cache: "no-store", timeout: 5000 });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const prediction = await response.json();
        renderPrediction(prediction);
    } catch (error) {
        console.warn("Prediction API unavailable, using fallback");
        renderPrediction(fallbackPrediction);
    }
}

function updateTimestamp(data) {
    const timestamp = data.timestamp || Date.now();
    const dateText = new Date(timestamp).toLocaleString();
    setText("lastUpdate", `Last updated: ${dateText}`);
}

function initializeSendDataButton() {
    const btn = document.getElementById("sendDataBtn");
    const status = document.getElementById("sendStatus");
    if (!btn) return;
    btn.addEventListener("click", async () => {
        btn.disabled = true;
        status.textContent = "Sending...";
        status.className = "send-status";
        try {
            // Retrieve current sensor snapshot from server, then forward full payload
            const snapshotResp = await fetch("/api/data");
            if (!snapshotResp.ok) throw new Error(`Snapshot HTTP ${snapshotResp.status}`);
            const payload = await snapshotResp.json();

            const response = await fetch("/api/send-data-to-telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: payload }) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            status.textContent = "✓ Sent to Telegram successfully!";
            status.className = "send-status success";
            setTimeout(() => { status.className = "send-status"; }, 4000);
        } catch (error) {
            status.textContent = `✗ Failed: ${error.message}`;
            status.className = "send-status error";
            setTimeout(() => { status.className = "send-status"; }, 4000);
        } finally { btn.disabled = false; }
    });
}

function render(data) {
    updateSensorStatuses(data.sensor_status);
    updateTopPanels(data);
    updateWaterSystem(data);
    updateTiltCard(data);
    updateMq2(data);
    updateMpu(data);
    updateTimestamp(data);
    fetchPrediction(data);
}

async function fetchData() {
    try {
        const response = await fetch("/api/data");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        render(withFallbackData(payload));
    } catch (error) {
        console.error("Data fetch failed, using fallback", error);
        render(withFallbackData(null));
    }
}

// ─── RAG Chatbot Functions ────────────────────────────────────────────────

async function initRAG() {
    try {
        // Load knowledge base
        const raw = await fetch('./disaster_knowledge_base.txt')
            .then(r => r.text())
            .catch(err => {
                console.warn('Could not load knowledge base:', err);
                return '';
            });
        
        const count = DisasterRAG.loadKnowledgeBase(raw);
        console.log('✅ RAG ready —', count, 'chunks loaded');
    } catch (err) {
        console.error('❌ RAG initialization failed:', err);
    }
}

// Typing animation effect for RAG responses
async function typeText(element, htmlContent, speed = 30) {
    element.innerHTML = '';
    
    // Parse HTML and create nodes for typing effect
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    
    let charIndex = 0;
    let totalChars = 0;
    
    // Count total characters to display
    const walkTreeForText = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            totalChars += node.textContent.length;
        } else {
            for (let child of node.childNodes) {
                walkTreeForText(child);
            }
        }
    };
    walkTreeForText(tempDiv);
    
    // Display text with typing effect
    const displayTyping = (node) => {
        return new Promise(async (resolve) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                let displayed = '';
                for (let char of text) {
                    displayed += char;
                    element.textContent = element.textContent + char;
                    await new Promise(r => setTimeout(r, speed));
                }
            } else {
                const newNode = document.createElement(node.tagName);
                // Copy attributes
                for (let attr of node.attributes) {
                    newNode.setAttribute(attr.name, attr.value);
                }
                element.appendChild(newNode);
                
                for (let child of node.childNodes) {
                    element.lastChild.appendChild(child.cloneNode(true));
                }
                
                let displayed = '';
                for (let child of newNode.childNodes) {
                    if (child.nodeType === Node.TEXT_NODE) {
                        const text = child.textContent;
                        for (let char of text) {
                            displayed += char;
                            child.textContent = displayed;
                            await new Promise(r => setTimeout(r, speed));
                        }
                    }
                }
            }
            resolve();
        });
    };
    
    // Simpler typing effect - just type out the visible text
    let displayText = '';
    const getPlainText = (html) => {
        const temp = document.createElement('div');
        temp.innerHTML = html;
        return temp.innerText;
    };
    
    element.innerHTML = '';
    
    // Type out character by character
    for (let char of getPlainText(htmlContent)) {
        displayText += char;
        element.innerText = displayText;
        await new Promise(r => setTimeout(r, speed));
    }
    
    // Then set the full HTML for proper formatting
    element.innerHTML = htmlContent;
}

async function askDisasterRAG(userMessage) {
    if (!userMessage.trim()) return;
    
    const outputDiv = document.getElementById('ragOutput');
    const inputField = document.getElementById('ragInput');
    
    try {
        // Show user message
        outputDiv.innerHTML = `<strong>You:</strong><br/>${escapeHtml(userMessage)}<br/><br/><em style="color:var(--text-muted);">🤖 Thinking...</em>`;
        inputField.value = '';
        
        // Get response from RAG
        const result = await DisasterRAG.askRAG(userMessage);
        
        // Build display text
        let displayText = `<strong>Assistant:</strong><br/>${escapeHtml(result.text).replace(/\n/g, '<br/>')}`;
        if (result.sources && result.sources.length > 0) {
            displayText += `<br/><br/><em style="color:var(--text-muted);">📚 Sources: ${result.sources.join(', ')}</em>`;
        }
        
        // Animate the response text with typing effect (ultra-fast: 2ms per char)
        await typeText(outputDiv, displayText, 2);
        
        outputDiv.scrollTop = outputDiv.scrollHeight;
        
        console.log('[RAG] Response:', result);
    } catch (err) {
        console.error('[RAG] Query error:', err);
        const errorMsg = escapeHtml(err.message || 'Unknown error occurred');
        const errorDisplay = `⚠️ <strong>Error:</strong><br/>Could not process your question.<br/><br/>${errorMsg}<br/><br/>Please check:<br/>• Network connection<br/>• API key is valid<br/>• Knowledge base loaded<br/>• Try again in a moment`;
        
        // Show error with typing animation (ultra-fast: 1ms per char)
        await typeText(outputDiv, errorDisplay, 1);
        
        console.error('[RAG] Full error:', err);
    }
}

// Helper function to escape HTML special characters
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function initializeRAGChat() {
    const ragInput = document.getElementById('ragInput');
    const ragSend = document.getElementById('ragSend');
    
    if (!ragInput || !ragSend) return;
    
    ragSend.addEventListener('click', () => {
        const msg = ragInput.value.trim();
        if (msg) askDisasterRAG(msg);
    });
    
    ragInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const msg = ragInput.value.trim();
            if (msg) askDisasterRAG(msg);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    initializeClock();
    initializeThemeToggle();
    initializeMpuChart();
    initializeUltrasonicChart();
    initializeSendDataButton();
    initializeRAGChat();
    initRAG();
    render(withFallbackData(null));
    fetchData();
    setInterval(fetchData, 2500);
});