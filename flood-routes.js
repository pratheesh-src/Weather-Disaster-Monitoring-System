// flood-routes.js - Server-side routes for flood data
const express = require('express');
const router = express.Router();

// Mock flood risk data - replace with real data from your IoT sensors or external APIs
let floodRiskZones = [
    {
        id: 1,
        name: "Downtown Area",
        riskLevel: "high",
        confidence: 85,
        coordinates: [[51.509, -0.08], [51.503, -0.06], [51.51, -0.04]],
        description: "High flood risk due to low elevation and poor drainage",
        timestamp: new Date().toISOString()
    },
    {
        id: 2,
        name: "Riverside District",
        riskLevel: "medium",
        confidence: 65,
        coordinates: [[51.52, -0.1], [51.515, -0.08], [51.525, -0.07]],
        description: "Medium risk area near river bank",
        timestamp: new Date().toISOString()
    },
    {
        id: 3,
        name: "Industrial Zone",
        riskLevel: "low",
        confidence: 45,
        coordinates: [[51.50, -0.12], [51.495, -0.11], [51.505, -0.10]],
        description: "Low risk area with good drainage systems",
        timestamp: new Date().toISOString()
    }
];

// ADDED: Sri Lanka specific risk data
let sriLankaRiskZones = {
    flood: [
        {
            id: 1001,
            name: "Colombo Flood Zone",
            riskLevel: "high",
            confidence: 90,
            coordinates: [[6.935, 79.84], [6.925, 79.85], [6.915, 79.86], [6.905, 79.87], [6.895, 79.85], [6.925, 79.83]],
            description: "Low-lying areas in Colombo prone to flooding during monsoon",
            district: "Colombo",
            timestamp: new Date().toISOString(),
            country: "Sri Lanka",
            type: "flood"
        },
        {
            id: 1002,
            name: "Kelani River Basin",
            riskLevel: "high",
            confidence: 85,
            coordinates: [[6.95, 80.10], [6.92, 80.15], [6.88, 80.20], [6.85, 80.18], [6.87, 80.12], [6.92, 80.08]],
            description: "Kelani River flood plains - high risk during heavy rainfall",
            district: "Colombo",
            timestamp: new Date().toISOString(),
            country: "Sri Lanka",
            type: "flood"
        },
        {
            id: 1003,
            name: "Gampaha District",
            riskLevel: "medium",
            confidence: 70,
            coordinates: [[7.08, 79.98], [7.05, 80.02], [7.02, 80.05], [6.98, 80.00], [7.00, 79.95], [7.06, 79.92]],
            description: "Urban flooding areas in Gampaha",
            district: "Gampaha",
            timestamp: new Date().toISOString(),
            country: "Sri Lanka",
            type: "flood"
        }
    ],
    landslide: [
        {
            id: 2001,
            name: "Nuwara Eliya Hills",
            riskLevel: "high",
            confidence: 88,
            coordinates: [[6.95, 80.75], [6.92, 80.78], [6.88, 80.82], [6.85, 80.78], [6.87, 80.72], [6.92, 80.70]],
            description: "Hilly terrain with high landslide risk during heavy rains",
            district: "Nuwara Eliya",
            timestamp: new Date().toISOString(),
            country: "Sri Lanka",
            type: "landslide"
        },
        {
            id: 2002,
            name: "Badulla District",
            riskLevel: "high",
            confidence: 82,
            coordinates: [[6.98, 81.05], [6.95, 81.08], [6.92, 81.12], [6.88, 81.08], [6.90, 81.02], [6.95, 81.00]],
            description: "Mountainous areas with landslide history",
            district: "Badulla",
            timestamp: new Date().toISOString(),
            country: "Sri Lanka",
            type: "landslide"
        },
        {
            id: 2003,
            name: "Kandy Hill Country",
            riskLevel: "medium",
            confidence: 65,
            coordinates: [[7.28, 80.60], [7.25, 80.65], [7.22, 80.68], [7.18, 80.65], [7.20, 80.58], [7.25, 80.55]],
            description: "Hilly areas around Kandy with moderate landslide risk",
            district: "Kandy",
            timestamp: new Date().toISOString(),
            country: "Sri Lanka",
            type: "landslide"
        }
    ]
};

// EXISTING ROUTES (keep all your original routes)

// API route to get flood risk zones
router.get('/flood-risk-zones', (req, res) => {
    // You can choose to return only original data or combined data
    // For now, returning only original data to maintain compatibility
    res.json(floodRiskZones);
});

// API route to update flood risk from IoT sensors
router.post('/flood-risk-update', (req, res) => {
    const sensorData = req.body;
    
    // Process sensor data and update flood risk zones
    updateFloodRiskFromSensors(sensorData);
    
    res.json({ 
        success: true, 
        message: "Flood risk data updated",
        zones: floodRiskZones 
    });
});

// API route for safe route calculation
router.post('/safe-route', (req, res) => {
    const { start, end, avoidFloodZones = true } = req.body;
    
    // Calculate safe route avoiding flood zones
    const safeRoute = calculateSafeRoute(start, end, avoidFloodZones);
    
    res.json(safeRoute);
});

// API to get current flood risk assessment
router.get('/flood-risk-assessment', (req, res) => {
    // This would integrate with your main sensor data
    // For now, return a mock assessment
    const assessment = {
        overallRisk: "medium",
        riskFactors: [
            { factor: "water_level", level: "high", value: 75 },
            { factor: "rainfall", level: "medium", value: 45 },
            { factor: "soil_moisture", level: "low", value: 30 }
        ],
        timestamp: new Date().toISOString(),
        recommendations: [
            "Monitor water levels closely",
            "Avoid low-lying areas",
            "Prepare emergency evacuation routes"
        ]
    };
    
    res.json(assessment);
});

// ADDED: New Sri Lanka specific routes

// Get all Sri Lanka risk zones (both flood and landslide)
router.get('/sri-lanka-risk-zones', (req, res) => {
    res.json(sriLankaRiskZones);
});

// Get Sri Lanka risk zones by type
router.get('/sri-lanka-risk-zones/:type', (req, res) => {
    const type = req.params.type.toLowerCase();
    
    if (type === 'flood') {
        res.json(sriLankaRiskZones.flood);
    } else if (type === 'landslide') {
        res.json(sriLankaRiskZones.landslide);
    } else {
        res.status(400).json({ error: "Invalid type. Use 'flood' or 'landslide'" });
    }
});

// Get risk zones by Sri Lankan district
router.get('/sri-lanka-risk-zones/district/:district', (req, res) => {
    const district = req.params.district.toLowerCase();
    
    const districtFloodZones = sriLankaRiskZones.flood.filter(zone => 
        zone.district.toLowerCase().includes(district)
    );
    
    const districtLandslideZones = sriLankaRiskZones.landslide.filter(zone => 
        zone.district.toLowerCase().includes(district)
    );
    
    res.json({
        district: district,
        floodZones: districtFloodZones,
        landslideZones: districtLandslideZones,
        totalZones: districtFloodZones.length + districtLandslideZones.length
    });
});

// Get combined risk data (both original and Sri Lanka data)
router.get('/all-risk-zones', (req, res) => {
    const allZones = {
        original: floodRiskZones,
        sriLanka: sriLankaRiskZones,
        totalZones: floodRiskZones.length + 
                   sriLankaRiskZones.flood.length + 
                   sriLankaRiskZones.landslide.length
    };
    res.json(allZones);
});

// ADDED: Sri Lanka emergency contacts
router.get('/sri-lanka-emergency-contacts', (req, res) => {
    const emergencyContacts = {
        "Police Emergency": "119",
        "Ambulance Service": "110", 
        "Disaster Management Center": "117",
        "Fire Brigade": "111",
        "Meteorological Department": "011-2694841",
        "Irrigation Department Flood Warning": "011-2588531",
        "National Building Research Organization (Landslides)": "011-2674564",
        "Coast Conservation Department": "011-2692703"
    };
    
    res.json(emergencyContacts);
});

// EXISTING FUNCTIONS (keep all your original functions)

function updateFloodRiskFromSensors(sensorData) {
    // Process IoT sensor data to update flood risk zones
    console.log('Updating flood risk from sensors:', sensorData);
    
    // Example logic to update zones based on sensor readings
    // You can implement more sophisticated algorithms here
    
    floodRiskZones.forEach(zone => {
        // Update risk levels based on sensor data
        // This is a simplified example
        if (sensorData.water_level_sensor && sensorData.water_level_sensor.percentage > 70) {
            if (zone.riskLevel !== 'high') {
                zone.riskLevel = 'high';
                zone.confidence = 90;
                zone.timestamp = new Date().toISOString();
                zone.description = "Risk elevated due to high water levels";
            }
        }
    });
    
    // ADDED: Also update Sri Lanka zones based on sensor data
    sriLankaRiskZones.flood.forEach(zone => {
        if (sensorData.water_level_sensor && sensorData.water_level_sensor.percentage > 70) {
            if (zone.riskLevel !== 'high') {
                zone.riskLevel = 'high';
                zone.confidence = 95;
                zone.timestamp = new Date().toISOString();
                zone.description += " - ACTIVE FLOOD WARNING";
            }
        }
    });
}

function calculateSafeRoute(start, end, avoidFloodZones) {
    // Calculate route that avoids flood zones
    // This would integrate with your routing logic
    // For now, return a mock route
    
    return {
        start: start,
        end: end,
        waypoints: [
            { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 }
        ],
        distance: 1250, // meters
        duration: 900, // seconds
        safe: true,
        warnings: avoidFloodZones ? ["Route avoids known flood zones"] : []
    };
}

// ADDED: Function to get Sri Lanka specific safe routes
function calculateSriLankaSafeRoute(start, end, avoidFloods = true, avoidLandslides = true) {
    const allRiskZones = [...sriLankaRiskZones.flood, ...sriLankaRiskZones.landslide];
    const avoidedTypes = [];
    
    if (avoidFloods) avoidedTypes.push('flood');
    if (avoidLandslides) avoidedTypes.push('landslide');
    
    return {
        start: start,
        end: end,
        waypoints: [
            { lat: (start.lat + end.lat) / 2, lng: (start.lng + end.lng) / 2 }
        ],
        distance: 1250,
        duration: 900,
        safe: true,
        country: "Sri Lanka",
        avoidedHazards: avoidedTypes,
        warnings: avoidedTypes.length > 0 ? [`Route avoids ${avoidedTypes.join(' and ')} zones`] : []
    };
}

// ADDED: Sri Lanka specific route calculation
router.post('/sri-lanka-safe-route', (req, res) => {
    const { start, end, avoidFloods = true, avoidLandslides = true } = req.body;
    
    const safeRoute = calculateSriLankaSafeRoute(start, end, avoidFloods, avoidLandslides);
    
    res.json(safeRoute);
});

module.exports = router;