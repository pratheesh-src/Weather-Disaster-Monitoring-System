'use strict';

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const path       = require('path');
const https      = require('https');

const app       = express();
const PORT      = process.env.PORT || 3001;
const publicDir = path.join(__dirname, 'public');

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(publicDir));

// ─── Telegram Configuration ───────────────────────────────────────────────────
const TELEGRAM_BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID    = process.env.TELEGRAM_CHAT_ID || '';
const ALERTS_ENABLED      = true;
const ALERT_COOLDOWN_SEC  = 900;

// ─── Ultrasonic Calibration & Accuracy Settings ──────────────────────────────
const ULTRASONIC_CONFIG = {
    houseHeightCm:          45,
    warningFloodCm:         15,
    criticalFloodCm:        30,
    medianFilterSize:       5,
    minValidDistance:       2,
    maxValidDistance:       50,
    calibrationOffset:      0,
    smoothingFactor:        0.3,
    temperatureCompensation: true,
    referenceTemperature:   20,
};

// ─── Water Level Threshold to activate Ultrasonic ────────────────────────────
// Ultrasonic will only activate when water level percentage is ABOVE this value
const WATER_LEVEL_ACTIVATION_THRESHOLD = 5; // percent

// ─── Runtime State ────────────────────────────────────────────────────────────
let distanceReadings = [];
let filteredDistance = 0;

let sensorData = {
    sensor_status: {
        dht11: true, rain: true, soil: true, ultrasonic: true,
        water_level_sensor: true, tilt: true, mq2: true,
        bmp180: true, mpu6050: true
    },
    dht11:              { temperature: 0, humidity: 0 },
    rain:               { raw: 0, percentage: 0 },
    soil:               { raw: 0, percentage: 0 },
    ultrasonic:         { distance: 0, enabled: false, disabled_reason: '' },
    water_level_sensor: { raw: 0, percentage: 0, timestamp: 0 },
    tilt:               { value: 0, state: 'LEVEL' },
    mq2: {
        raw: 0, baseline: 0, lpg: 0, propane: 0, methane: 0,
        hydrogen: 0, smoke: 0, alcohol: 0, co: 0,
        safety_status: 'AIR_SAFE', alert_message: ''
    },
    bmp180:  { pressure: 0, altitude: 0, temperature: 0 },
    mpu6050: {
        acceleration: { x: 0, y: 0, z: 0 },
        gyroscope:    { x: 0, y: 0, z: 0 }
    },
    timestamp:         0,
    ultrasonic_enabled: false
};

let alertCategoryCooldowns = { FLOOD: 0, WATER_LEVEL: 0, RAIN: 0, SOIL: 0 };
let latestAlertsSnapshot   = {
    alerts: [], severity: 'SAFE', generatedAt: null, source: 'server'
};

let floodRiskZones = [
    {
        id: 1, name: 'Downtown Area', riskLevel: 'high', confidence: 85,
        coordinates: [[51.509, -0.08], [51.503, -0.06], [51.51, -0.04]],
        description: 'High flood risk due to low elevation and poor drainage',
        timestamp: new Date().toISOString()
    },
    {
        id: 2, name: 'Riverside District', riskLevel: 'medium', confidence: 65,
        coordinates: [[51.52, -0.1], [51.515, -0.08], [51.525, -0.07]],
        description: 'Medium risk area near river bank',
        timestamp: new Date().toISOString()
    },
    {
        id: 3, name: 'Industrial Zone', riskLevel: 'low', confidence: 45,
        coordinates: [[51.50, -0.12], [51.495, -0.11], [51.505, -0.10]],
        description: 'Low risk area with good drainage systems',
        timestamp: new Date().toISOString()
    }
];

// ─── Core Business Logic ──────────────────────────────────────────────────────

/**
 * Returns true only when the water level sensor is working AND reading
 * above WATER_LEVEL_ACTIVATION_THRESHOLD. This is the single gate that
 * controls whether ultrasonic is enabled.
 */
function isWaterLevelSensorValid(data) {
    const waterPct    = data?.water_level_sensor?.percentage || 0;
    const isWorking   = data?.sensor_status?.water_level_sensor === true;
    const aboveThreshold = waterPct > WATER_LEVEL_ACTIVATION_THRESHOLD;
    console.log(
        `🔍 Water Level Check: waterPct=${waterPct}%, ` +
        `threshold=${WATER_LEVEL_ACTIVATION_THRESHOLD}%, ` +
        `aboveThreshold=${aboveThreshold}, sensorWorking=${isWorking}`
    );
    return isWorking && aboveThreshold;
}

/**
 * Applies temperature compensation, range validation, median filtering,
 * and exponential smoothing to a raw ultrasonic distance reading.
 */
function processUltrasonicReading(rawDistance, temperature = 25) {
    let calibrated = rawDistance + ULTRASONIC_CONFIG.calibrationOffset;

    if (ULTRASONIC_CONFIG.temperatureCompensation && temperature) {
        const speedNow = 331.3 + (0.606 * temperature);
        const speedRef = 331.3 + (0.606 * ULTRASONIC_CONFIG.referenceTemperature);
        calibrated = calibrated * (speedNow / speedRef);
    }

    if (calibrated < ULTRASONIC_CONFIG.minValidDistance) {
        return { valid: false, distance: 0, reason: 'TOO_CLOSE' };
    }
    if (calibrated > ULTRASONIC_CONFIG.maxValidDistance) {
        return { valid: false, distance: ULTRASONIC_CONFIG.maxValidDistance, reason: 'OUT_OF_RANGE' };
    }

    distanceReadings.push(calibrated);
    if (distanceReadings.length > ULTRASONIC_CONFIG.medianFilterSize) distanceReadings.shift();

    let medianDistance = calibrated;
    if (distanceReadings.length >= 3) {
        const sorted = [...distanceReadings].sort((a, b) => a - b);
        medianDistance = sorted[Math.floor(sorted.length / 2)];
    }

    filteredDistance = filteredDistance === 0
        ? medianDistance
        : (ULTRASONIC_CONFIG.smoothingFactor * medianDistance) +
          ((1 - ULTRASONIC_CONFIG.smoothingFactor) * filteredDistance);

    return {
        valid:            true,
        distance:         parseFloat(filteredDistance.toFixed(1)),
        rawDistance,
        medianDistance:   parseFloat(medianDistance.toFixed(1)),
        filteredDistance: parseFloat(filteredDistance.toFixed(1)),
        reason:           'OK'
    };
}

/** Converts a sensor-to-surface distance into flood depth + status. */
function calculateFloodDepth(distanceCm) {
    const houseH = ULTRASONIC_CONFIG.houseHeightCm;

    if (distanceCm <= 0) {
        return {
            floodDepthCm: houseH, floodPercent: 100,
            status: 'CRITICAL', warning: '🚨 Sensor submerged — Complete flooding!'
        };
    }
    if (distanceCm >= houseH) {
        return { floodDepthCm: 0, floodPercent: 0, status: 'CLEAR', warning: null };
    }

    const floodDepthCm  = houseH - distanceCm;
    const floodPercent  = parseFloat(((floodDepthCm / houseH) * 100).toFixed(2));
    let   status        = 'MONITORING';
    if      (floodDepthCm >= ULTRASONIC_CONFIG.criticalFloodCm) status = 'CRITICAL';
    else if (floodDepthCm >= ULTRASONIC_CONFIG.warningFloodCm)  status = 'WARNING';

    return { floodDepthCm: parseFloat(floodDepthCm.toFixed(1)), floodPercent, status, warning: null };
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/data  — receive payload from ESP32
app.post('/api/data', (req, res) => {
    const rawData = req.body;

    console.log('\n📥 RAW DATA RECEIVED:');
    console.log(`   Water Level: ${rawData?.water_level_sensor?.percentage}% (raw: ${rawData?.water_level_sensor?.raw})`);
    console.log(`   Ultrasonic Distance: ${rawData?.ultrasonic?.distance} cm`);

    // Stamp arrival time on the water level reading
    if (rawData.water_level_sensor) rawData.water_level_sensor.timestamp = Date.now();

    const waterLevelValid   = isWaterLevelSensorValid(rawData);
    let   processedUltrasonic = null;

    if (waterLevelValid) {
        console.log(`✅ Water level ABOVE ${WATER_LEVEL_ACTIVATION_THRESHOLD}% — ENABLING ultrasonic`);

        if (rawData.ultrasonic?.distance !== undefined) {
            const temperature     = rawData.dht11?.temperature || 25;
            processedUltrasonic   = processUltrasonicReading(rawData.ultrasonic.distance, temperature);

            if (processedUltrasonic.valid) {
                Object.assign(rawData.ultrasonic, {
                    distance:          processedUltrasonic.distance,
                    raw_distance:      processedUltrasonic.rawDistance,
                    median_distance:   processedUltrasonic.medianDistance,
                    filtered_distance: processedUltrasonic.filteredDistance,
                });
            }
        }

        rawData.ultrasonic = Object.assign(
            rawData.ultrasonic || { distance: 45 },
            { enabled: true, disabled_reason: '', water_level_active: true }
        );
        console.log('   🔓 Ultrasonic ENABLED');

    } else {
        const waterPct = rawData?.water_level_sensor?.percentage || 0;
        const reason   = waterPct <= WATER_LEVEL_ACTIVATION_THRESHOLD
            ? `Water level ${waterPct}% is at or below ${WATER_LEVEL_ACTIVATION_THRESHOLD}% threshold`
            : 'Water level sensor not working';
        console.log(`❌ Ultrasonic DISABLED — ${reason}`);
        if (rawData.ultrasonic) {
            rawData.ultrasonic.enabled         = false;
            rawData.ultrasonic.disabled_reason = reason;
        }
    }

    if (rawData.sensor_status) {
        rawData.sensor_status.ultrasonic                = waterLevelValid;
        rawData.sensor_status.ultrasonic_dependency_met = waterLevelValid;
    }

    sensorData                   = rawData;
    sensorData.timestamp         = Date.now();
    sensorData.ultrasonic_enabled = waterLevelValid;

    const enabled  = sensorData.ultrasonic?.enabled === true;
    const distance = sensorData.ultrasonic?.distance || 0;

    console.log('\n📊 FINAL STATUS:');
    console.log(`   Water Valid (>5%): ${waterLevelValid}`);
    console.log(`   Ultrasonic Enabled: ${enabled}`);
    console.log(`   Ultrasonic Distance: ${distance} cm`);
    if (enabled && distance > 0) {
        const flood = calculateFloodDepth(distance);
        console.log(`   🌊 FLOOD DEPTH: ${flood.floodDepthCm} cm (${flood.floodPercent}%) → ${flood.status}`);
    }

    updateFloodRiskFromSensors(sensorData);
    evaluateAndSendAlerts(sensorData).catch(err => console.error('Alert error:', err));

    res.status(200).json({
        message:                  'Data received successfully',
        ultrasonic_enabled:       enabled,
        water_level_valid:        waterLevelValid,
        water_level_percentage:   rawData?.water_level_sensor?.percentage || 0,
        activation_threshold:     WATER_LEVEL_ACTIVATION_THRESHOLD,
        flood_depth:              enabled && distance > 0 ? calculateFloodDepth(distance).floodDepthCm : null,
        processed:                processedUltrasonic
    });
});

// GET /api/data  — latest snapshot for dashboard
app.get('/api/data', (req, res) => res.json(sensorData));

// GET /api/flood-depth  — detailed flood depth query
app.get('/api/flood-depth', (req, res) => {
    const waterValid = isWaterLevelSensorValid(sensorData);
    const enabled    = sensorData.ultrasonic?.enabled === true;
    const rawDistance = Number(sensorData?.ultrasonic?.distance || 0);
    const temperature = Number(sensorData?.dht11?.temperature || 25);
    const waterPct    = sensorData?.water_level_sensor?.percentage || 0;

    console.log(
        `📡 Flood Depth API: waterPct=${waterPct}%, waterValid=${waterValid}, ` +
        `ultrasonic.enabled=${enabled}, distance=${rawDistance}`
    );

    if (!waterValid) {
        return res.json({
            available:           false,
            enabled:             false,
            reason:              `Water level sensor reads ${waterPct}% — must exceed ${WATER_LEVEL_ACTIVATION_THRESHOLD}% to activate ultrasonic`,
            activationThreshold: WATER_LEVEL_ACTIVATION_THRESHOLD,
            waterLevelSensor:    { percentage: waterPct, raw: sensorData?.water_level_sensor?.raw },
            floodDepthCm:        null,
            floodPercent:        null,
            status:              'WAITING_FOR_WATER_DATA'
        });
    }

    if (!enabled) {
        return res.json({
            available: true, enabled: false,
            reason: 'Ultrasonic not enabled yet',
            floodDepthCm: null, floodPercent: null,
            status: 'ULTRASONIC_NOT_ENABLED'
        });
    }

    const processed = processUltrasonicReading(rawDistance, temperature);

    if (!processed.valid) {
        const submerged = processed.reason === 'TOO_CLOSE';
        return res.json({
            available:    true,
            enabled:      true,
            valid:        false,
            reason:       processed.reason,
            floodDepthCm: submerged ? ULTRASONIC_CONFIG.houseHeightCm : null,
            floodPercent: submerged ? 100 : null,
            status:       submerged ? 'SENSOR_SUBMERGED' : 'INVALID_READING'
        });
    }

    const flood = calculateFloodDepth(processed.distance);
    res.json({
        available:    true,
        enabled:      true,
        valid:        true,
        floodDepthCm: flood.floodDepthCm,
        floodPercent: flood.floodPercent,
        status:       flood.status,
        warning:      flood.warning,
        houseHeightCm: ULTRASONIC_CONFIG.houseHeightCm,
        distance:     processed.distance
    });
});

// GET /api/flood-risk-zones
app.get('/api/flood-risk-zones', (req, res) => res.json(floodRiskZones));

// GET /api/alerts/latest
app.get('/api/alerts/latest', (req, res) => {
    const alerts = getCurrentAlerts(sensorData);
    latestAlertsSnapshot = {
        alerts,
        severity:    alerts.some(a => a.severity === 'CRITICAL') ? 'CRITICAL'
                   : alerts.length > 0 ? 'WARNING' : 'SAFE',
        generatedAt: new Date().toISOString(),
        source:      'server'
    };
    res.json(latestAlertsSnapshot);
});

// GET /api/flood-risk-assessment
app.get('/api/flood-risk-assessment', (req, res) => {
    res.json({
        overallRisk:  calculateOverallFloodRisk(),
        riskFactors: [
            { factor: 'water_level', level: getRiskLevel(sensorData.water_level_sensor?.percentage || 0, [20, 40, 70]), value: sensorData.water_level_sensor?.percentage || 0 },
            { factor: 'rainfall',    level: getRiskLevel(sensorData.rain?.percentage || 0,          [30, 50, 70]), value: sensorData.rain?.percentage || 0 },
            { factor: 'soil_moisture', level: getRiskLevel(sensorData.soil?.percentage || 0,        [40, 60, 80]), value: sensorData.soil?.percentage || 0 }
        ],
        timestamp:       new Date().toISOString(),
        recommendations: getFloodRecommendations()
    });
});

// POST /api/send-to-telegram  &  POST /api/send-data-to-telegram
async function handleSendToTelegram(req, res) {
    try {
        const msg = buildStatusMessage();
        await sendTelegramMessagePlain(msg);
        res.json({ success: true, message: 'Data sent to Telegram' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
app.post('/api/send-to-telegram',    handleSendToTelegram);
app.post('/api/send-data-to-telegram', handleSendToTelegram);

// POST /api/alerts/dashboard-event  — receive lightweight events from dashboard (tilt/earthquake)
app.post('/api/alerts/dashboard-event', async (req, res) => {
    try {
        const { eventType } = req.body || {};
        if (!eventType) return res.status(400).json({ error: 'Provide eventType in body' });

        const upper = String(eventType).toUpperCase();
        let category = upper;
        let lines = [];

        console.log(`\n📨 [DASHBOARD-EVENT] Received ${upper} from dashboard`);

        if (upper === 'EARTHQUAKE') {
            category = 'EARTHQUAKE';
            lines = [
                '⚠️ *Earthquake Alert*',
                '',
                '🌍 The MPU6050 acceleration and gyroscope sensor has detected heavy ground movement.',
                '',
                '🏃 Residents are advised to move to a safe open area immediately.',
                '',
                '🪟 Stay away from windows, walls, and falling objects.',
                '',
                '🛑 Remain calm and follow emergency instructions from local authorities.',
                '',
                `🕒 ${new Date().toLocaleString()}`
            ];
        } else if (upper === 'TILT' || upper === 'TILTED') {
            category = 'TILT';
            lines = [
                '⚠️ *Landslide Warning*',
                '',
                '🚨 A landslide risk has been detected near USJP FOT due to soil movement.',
                '',
                '🏃‍♂️ Residents are advised to evacuate immediately to safe locations.',
                '',
                '⛰️ Avoid hills, slopes, and unstable ground.',
                '',
                '📢 Follow instructions from local authorities.',
                '',
                `🕒 ${new Date().toLocaleString()}`
            ];
        } else {
            return res.status(400).json({ error: 'Unhandled eventType' });
        }

        const msg = lines.join('\n');
        console.log(`📤 [DASHBOARD-EVENT] Forwarding ${category} to Telegram...`);
        await sendTelegramMessage(msg);
        res.json({ success: true });
    } catch (err) {
        console.error('[DASHBOARD-EVENT] handler error:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/test/inject-alert  — TESTING ONLY: inject fake sensor data to trigger alerts
app.post('/api/test/inject-alert', (req, res) => {
    const { type } = req.body || {};
    
    console.log(`\n🧪 [TEST] Injecting ${type} alert...`);
    
    if (type === 'TILT') {
        sensorData.tilt = { value: 1, state: 'TILTED' };
    } else if (type === 'EARTHQUAKE') {
        // Trigger large acceleration change to trigger shake detection
        sensorData.mpu6050.acceleration = { x: 5000, y: 5000, z: 5000 };
        sensorData.mpu6050.gyroscope = { x: 1500, y: 1500, z: 1500 };
    } else {
        return res.status(400).json({ error: 'type must be TILT or EARTHQUAKE' });
    }
    
    sensorData.timestamp = Date.now();
    res.json({ success: true, message: `${type} data injected`, sensorData });
});

// POST /api/calibrate-ultrasonic
app.post('/api/calibrate-ultrasonic', (req, res) => {
    const { offset } = req.body;
    if (typeof offset === 'number') {
        ULTRASONIC_CONFIG.calibrationOffset = offset;
        distanceReadings = [];
        filteredDistance = 0;
        res.json({ success: true, message: 'Calibration updated', newOffset: offset });
    } else {
        res.status(400).json({ error: 'Provide offset as a number' });
    }
});

// POST /api/flood-risk-update
app.post('/api/flood-risk-update', (req, res) => {
    updateFloodRiskFromSensors(req.body);
    res.json({ success: true, message: 'Flood risk data updated', zones: floodRiskZones });
});

// SPA fallback — serve index.html for all non-API GET routes
app.get('/',          (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/flood-map', (req, res) => res.sendFile(path.join(publicDir, 'flood-map.html')));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
});

// ─── Alert Logic ──────────────────────────────────────────────────────────────

function getUltrasonicFloodAlert(data) {
    if (!isWaterLevelSensorValid(data))          return null;
    if (data?.ultrasonic?.enabled !== true)       return null;

    const rawDistance   = Number(data?.ultrasonic?.distance || 0);
    const temperature   = Number(data?.dht11?.temperature || 25);
    const processed     = processUltrasonicReading(rawDistance, temperature);

    if (!processed.valid) {
        if (processed.reason === 'TOO_CLOSE') {
            return {
                severity: 'CRITICAL', category: 'FLOOD',
                message:  '🚨 CRITICAL: Ultrasonic sensor submerged! House may be fully flooded!',
                floodDepthCm: ULTRASONIC_CONFIG.houseHeightCm,
                floodPercent: 100
            };
        }
        return null;
    }

    const flood = calculateFloodDepth(processed.distance);
    if (flood.status === 'CRITICAL') {
        return {
            severity: 'CRITICAL', category: 'FLOOD',
            message:  `🚨 CRITICAL FLOOD: ${flood.floodDepthCm} cm of water (${flood.floodPercent}% of house) — EVACUATE IMMEDIATELY!`,
            floodDepthCm: flood.floodDepthCm, floodPercent: flood.floodPercent
        };
    }
    if (flood.status === 'WARNING') {
        return {
            severity: 'WARNING', category: 'FLOOD',
            message:  `⚠️ FLOOD WARNING: ${flood.floodDepthCm} cm of water detected — take precautions!`,
            floodDepthCm: flood.floodDepthCm, floodPercent: flood.floodPercent
        };
    }
    return null;
}

function getCurrentAlerts(data) {
    const alerts   = [];
    const waterPct = Number(data?.water_level_sensor?.percentage || 0);
    if      (waterPct >= 70) alerts.push({ severity: 'CRITICAL', category: 'WATER_LEVEL', message: `🚨 CRITICAL: Water level at ${waterPct.toFixed(1)}% — immediate action required!` });
    else if (waterPct >= 40) alerts.push({ severity: 'WARNING',  category: 'WATER_LEVEL', message: `⚠️ WARNING: Water level rising at ${waterPct.toFixed(1)}%` });

    const ultrasonicAlert = getUltrasonicFloodAlert(data);
    if (ultrasonicAlert) alerts.push(ultrasonicAlert);

    const rainPct = Number(data?.rain?.percentage || 0);
    if      (rainPct >= 70) alerts.push({ severity: 'CRITICAL', category: 'RAIN', message: `🚨 CRITICAL: Heavy rainfall at ${rainPct.toFixed(1)}% — seek shelter!` });
    else if (rainPct >= 50) alerts.push({ severity: 'WARNING',  category: 'RAIN', message: `⚠️ WARNING: Heavy rainfall at ${rainPct.toFixed(1)}%` });

    const soilPct = Number(data?.soil?.percentage || 0);
    if      (soilPct >= 90) alerts.push({ severity: 'CRITICAL', category: 'SOIL', message: `🚨 CRITICAL: Soil saturation at ${soilPct.toFixed(1)}% — flooding highly likely!` });
    else if (soilPct >= 70) alerts.push({ severity: 'WARNING',  category: 'SOIL', message: `⚠️ WARNING: Soil saturation at ${soilPct.toFixed(1)}%` });

    return alerts;
}

async function evaluateAndSendAlerts(data) {
    const alerts = getCurrentAlerts(data);
    const now    = Date.now();

    latestAlertsSnapshot = {
        alerts,
        severity:    alerts.some(a => a.severity === 'CRITICAL') ? 'CRITICAL'
                   : alerts.length > 0 ? 'WARNING' : 'SAFE',
        generatedAt: new Date().toISOString(),
        source:      'server'
    };

    if (!ALERTS_ENABLED || alerts.length === 0) return;

    const cooldownMs  = ALERT_COOLDOWN_SEC * 1000;
    const alertsToSend = alerts.filter(alert => {
        const lastSent = alertCategoryCooldowns[alert.category] || 0;
        return (now - lastSent) >= cooldownMs;
    });

    alertsToSend.forEach(a => { alertCategoryCooldowns[a.category] = now; });

    if (alertsToSend.length === 0) return;
    try {
        await sendTelegramMessage(buildAlertMessage(alertsToSend));
    } catch (err) {
        console.error('❌ Telegram send failed:', err.message);
    }
}

// ─── Telegram Message Builders ────────────────────────────────────────────────

function buildAlertMessage(alerts) {
    const lines = [
        '🏠 *IoT Flood Monitoring System*',
        `🕒 ${new Date().toLocaleString()}`,
        '',
        '*ACTIVE ALERTS:*',
        ''
    ];

    for (const alert of alerts) {
        const icon = alert.severity === 'CRITICAL' ? '🚨' : '⚠️';
        lines.push(`${icon} *${alert.severity}* — ${alert.category}`);
        lines.push(`   ${alert.message}`);
        lines.push('');
    }

    const enabled  = sensorData.ultrasonic?.enabled === true;
    const distance = Number(sensorData?.ultrasonic?.distance || 0);
    const houseH   = ULTRASONIC_CONFIG.houseHeightCm;

    lines.push('📡 *Current Flood Status:*');
    if (enabled && distance > 0) {
        if (distance <= 0) {
            lines.push('   🚨 Sensor submerged — complete flooding!');
        } else if (distance < houseH) {
            const flood = calculateFloodDepth(distance);
            lines.push(`   💧 Flood depth  : ${flood.floodDepthCm} cm of ${houseH} cm house`);
            lines.push(`   📊 Filled       : ${flood.floodPercent}%`);
            lines.push(`   🔰 Status       : ${flood.status}`);
        } else {
            lines.push(`   ✅ No flooding — sensor reads ${distance} cm`);
        }
    } else {
        lines.push(`   ⚠️ Ultrasonic standby — water level at or below ${WATER_LEVEL_ACTIVATION_THRESHOLD}%.`);
    }

    lines.push('', '_Sent from ESP32 Monitoring Station_');
    return lines.join('\n');
}

function buildStatusMessage() {
    const waterLevel = sensorData.water_level_sensor?.percentage ?? 0;
    const distance   = Number(sensorData.ultrasonic?.distance ?? 0);
    
    return `📊 SENSOR DATA REPORT
🕒 Time: ${new Date().toLocaleString()}

🌡️ ENVIRONMENTAL
🌡️ Temperature: ${String(sensorData.dht11?.temperature ?? 0)} C
💨 Humidity: ${String(sensorData.dht11?.humidity ?? 0)}%
🌧️ Rain: ${String(sensorData.rain?.percentage ?? 0)}%
🌱 Soil Moisture: ${String(sensorData.soil?.percentage ?? 0)}%

💧 WATER
💦 Water Level: ${String(waterLevel)}%
📡 Ultrasonic Distance: ${String(distance)} cm

⚙️ MOTION & STRUCTURE
🏢 Tilt State: ${String(sensorData.tilt?.state ?? 'UNKNOWN')}
📍 Tilt Value: ${String(sensorData.tilt?.value ?? 0)}
📈 Accel X: ${String(sensorData.mpu6050?.acceleration?.x ?? 0)}
📈 Accel Y: ${String(sensorData.mpu6050?.acceleration?.y ?? 0)}
📈 Accel Z: ${String(sensorData.mpu6050?.acceleration?.z ?? 0)}
🔄 Gyro X: ${String(sensorData.mpu6050?.gyroscope?.x ?? 0)}
🔄 Gyro Y: ${String(sensorData.mpu6050?.gyroscope?.y ?? 0)}
🔄 Gyro Z: ${String(sensorData.mpu6050?.gyroscope?.z ?? 0)}

⚠️ AIR QUALITY
💨 Smoke: ${String(sensorData.mq2?.smoke ?? 0)}
🔥 LPG: ${String(sensorData.mq2?.lpg ?? 0)}
🔥 Propane: ${String(sensorData.mq2?.propane ?? 0)}
🔥 Methane: ${String(sensorData.mq2?.methane ?? 0)}
⚡ CO: ${String(sensorData.mq2?.co ?? 0)}
✓ Status: ${String(sensorData.mq2?.safety_status ?? 'UNKNOWN')}

🔬 ATMOSPHERE
🌡️ Temperature: ${String(sensorData.bmp180?.temperature ?? 0)} C
🌪️ Pressure: ${String(sensorData.bmp180?.pressure ?? 0)} hPa
⛰️ Altitude: ${String(sensorData.bmp180?.altitude ?? 0)} m`;
}

function sendTelegramMessage(text) {
    return new Promise((resolve, reject) => {
        const payload = new URLSearchParams({
            chat_id:    TELEGRAM_CHAT_ID,
            text,
            parse_mode: 'Markdown'
        }).toString();

        const options = {
            hostname: 'api.telegram.org',
            port:     443,
            path:     `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            method:   'POST',
            headers:  {
                'Content-Type':   'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, res => {
            let body = '';
            res.on('data',  chunk => { body += chunk; });
            res.on('end',   ()    => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log(`✅ [TELEGRAM] Message sent successfully (id: ${json?.result?.message_id || 'unknown'})`);
                        resolve(body);
                    } else {
                        const errMsg = `[TELEGRAM] API error ${res.statusCode}: ${json?.description || body}`;
                        console.error(`❌ ${errMsg}`);
                        reject(new Error(errMsg));
                    }
                } catch (e) {
                    console.error(`❌ [TELEGRAM] Parse error: ${body}`);
                    reject(e);
                }
            });
        });
        req.on('error', err => {
            console.error(`❌ [TELEGRAM] Network error:`, err.message);
            reject(err);
        });
        req.write(payload);
        req.end();
    });
}

function sendTelegramMessagePlain(text) {
    return new Promise((resolve, reject) => {
        const payload = new URLSearchParams({
            chat_id: TELEGRAM_CHAT_ID,
            text
        }).toString();

        const options = {
            hostname: 'api.telegram.org',
            port:     443,
            path:     `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            method:   'POST',
            headers:  {
                'Content-Type':   'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, res => {
            let body = '';
            res.on('data',  chunk => { body += chunk; });
            res.on('end',   ()    => {
                try {
                    const json = JSON.parse(body);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log(`✅ [TELEGRAM] Sensor data sent (id: ${json?.result?.message_id || 'unknown'})`);
                        resolve(body);
                    } else {
                        const errMsg = `[TELEGRAM] API error ${res.statusCode}: ${json?.description || body}`;
                        console.error(`❌ ${errMsg}`);
                        reject(new Error(errMsg));
                    }
                } catch (e) {
                    console.error(`❌ [TELEGRAM] Parse error: ${body}`);
                    reject(e);
                }
            });
        });
        req.on('error', err => {
            console.error(`❌ [TELEGRAM] Network error:`, err.message);
            reject(err);
        });
        req.write(payload);
        req.end();
    });
}

// ─── Risk / Recommendation Helpers ───────────────────────────────────────────

function updateFloodRiskFromSensors(data) {
    const waterLevel = data.water_level_sensor?.percentage || 0;
    const rainfall   = data.rain?.percentage || 0;

    floodRiskZones.forEach(zone => {
        if (waterLevel > 70 || rainfall > 70) {
            zone.riskLevel   = 'high';
            zone.confidence  = 90;
            zone.description = 'Risk elevated due to high water levels and rainfall';
        } else if (waterLevel > 40 || rainfall > 50) {
            if (zone.riskLevel === 'low') { zone.riskLevel = 'medium'; zone.confidence = 75; }
            zone.description = 'Risk increased due to moderate water levels';
        }
        zone.timestamp = new Date().toISOString();
    });
}

function calculateOverallFloodRisk() {
    const w = sensorData.water_level_sensor?.percentage || 0;
    const r = sensorData.rain?.percentage || 0;
    const s = sensorData.soil?.percentage || 0;
    let score = 0;
    if (w > 70) score += 3; else if (w > 40) score += 2; else if (w > 20) score += 1;
    if (r > 70) score += 2; else if (r > 40) score += 1;
    if (s > 80) score += 1;
    if (score >= 4) return 'HIGH';
    if (score >= 2) return 'MEDIUM';
    return 'LOW';
}

function getRiskLevel(value, thresholds) {
    if (value > thresholds[2]) return 'high';
    if (value > thresholds[1]) return 'medium';
    if (value > thresholds[0]) return 'low';
    return 'very low';
}

function getFloodRecommendations() {
    const risk = calculateOverallFloodRisk();
    if (risk === 'HIGH')   return ['Immediate evacuation recommended', 'Avoid all low-lying areas', 'Monitor emergency broadcasts'];
    if (risk === 'MEDIUM') return ['Prepare emergency supplies', 'Avoid flood-prone routes', 'Monitor water levels closely'];
    return ['Normal conditions — stay alert', 'Keep emergency contacts handy'];
}

// ─── SECURE API PROXY ENDPOINTS ────────────────────────────────────────────────

/**
 * POST /api/rag-query
 * Proxies RAG queries to Gemini API with API key stored securely server-side.
 * Frontend never sees the API key.
 */
app.post('/api/rag-query', async (req, res) => {
    try {
        const { query, context } = req.body;
        
        if (!query || !context) {
            return res.status(400).json({ error: 'query and context required' });
        }

        const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
        if (!GEMINI_API_KEY) {
            console.warn('[RAG] GEMINI_API_KEY not set in environment');
            return res.status(500).json({ error: 'API configuration incomplete' });
        }

        const SYSTEM_PROMPT = `You are a disaster safety RAG assistant. Answer ONLY using provided context. Start with SEVERITY: (HIGH RISK, MODERATE RISK, or INFORMATIONAL).`;
        
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
        const body = {
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{
                role: 'user',
                parts: [{ text: context + '\n\n---\nQUESTION: ' + query }]
            }],
            generationConfig: { temperature: 0.3, maxOutputTokens: 700 }
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        if (!response.ok || data?.error) {
            console.error('[RAG] Gemini error:', data?.error?.message);
            return res.status(response.status).json({ error: 'RAG processing failed' });
        }

        const result = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        res.json({ text: result });
    } catch (err) {
        console.error('[RAG] Endpoint error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/prediction/latest
 * Proxies prediction requests to Python backend.
 * Hides the actual Python server URL from frontend.
 */
app.get('/api/prediction/latest', async (req, res) => {
    try {
        const PYTHON_API = process.env.PYTHON_PREDICTOR_API || 'http://127.0.0.1:5001/api/prediction/latest';
        
        const response = await fetch(PYTHON_API, { 
            cache: 'no-store',
            timeout: 5000 
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Prediction service unavailable' });
        }

        const data = await response.json();
        res.json(data);
    } catch (err) {
        console.warn('[Prediction] Service unavailable:', err.message);
        res.status(503).json({ error: 'Prediction service temporarily unavailable' });
    }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`\n🔗 ULTRASONIC ACTIVATION RULE:`);
    console.log(`   Ultrasonic activates ONLY when water level percentage > ${WATER_LEVEL_ACTIVATION_THRESHOLD}%`);
    console.log(`   ⏳ Below or equal to ${WATER_LEVEL_ACTIVATION_THRESHOLD}% → ultrasonic stays DISABLED\n`);
});