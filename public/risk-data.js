// Sri Lanka Risk Data - Flood Prone Areas
const floodRiskZones = [
    {
        id: 1,
        name: "Colombo Flood Zone",
        riskLevel: "medium",
        type: "flood",
        coordinates: [
            [6.927, 79.85], [6.917, 79.86], [6.907, 79.87], 
            [6.897, 79.85], [6.907, 79.83], [6.927, 79.84]
        ],
        description: "Low-lying areas in Colombo prone to flooding during monsoon seasons",
        severity: "Medium",
        affectedAreas: ["Colombo City", "Commercial areas"],
        timestamp: new Date().toISOString()
    },
    {
        id: 2,
        name: "Kalutara Coastal Areas",
        riskLevel: "medium",
        type: "flood",
        coordinates: [
            [6.58, 79.95], [6.57, 80.00], [6.56, 80.05],
            [6.54, 80.02], [6.55, 79.97], [6.57, 79.92]
        ],
        description: "Coastal flooding areas in Kalutara district",
        severity: "Medium",
        affectedAreas: ["Kalutara Town", "Coastal villages"],
        timestamp: new Date().toISOString()
    },
    {
        id: 3,
        name: "Gampaha Lowlands",
        riskLevel: "medium",
        type: "flood",
        coordinates: [
            [7.08, 79.98], [7.06, 80.02], [7.04, 80.05],
            [7.02, 80.02], [7.04, 79.97], [7.07, 79.95]
        ],
        description: "Urban flooding areas in Gampaha district",
        severity: "Medium",
        affectedAreas: ["Gampaha Town", "Industrial zones"],
        timestamp: new Date().toISOString()
    },
    {
        id: 4,
        name: "Kelani River Basin",
        riskLevel: "high",
        type: "flood",
        coordinates: [
            [6.96, 80.08], [6.94, 80.12], [6.92, 80.15],
            [6.90, 80.12], [6.92, 80.08], [6.95, 80.05]
        ],
        description: "Extreme flood risk area in Kelani River basin",
        severity: "High",
        affectedAreas: ["Kelani River banks", "Surrounding villages"],
        timestamp: new Date().toISOString()
    },
    {
        id: 5,
        name: "Negombo Lagoon Area",
        riskLevel: "medium",
        type: "flood",
        coordinates: [
            [7.20, 79.83], [7.18, 79.85], [7.16, 79.87],
            [7.14, 79.85], [7.16, 79.81], [7.19, 79.82]
        ],
        description: "Low-lying areas around Negombo lagoon prone to tidal flooding",
        severity: "Medium",
        affectedAreas: ["Negombo City", "Fishing communities"],
        timestamp: new Date().toISOString()
    },
    {
        id: 6,
        name: "Batticaloa Lagoon Basin",
        riskLevel: "high",
        type: "flood",
        coordinates: [
            [7.70, 81.70], [7.68, 81.72], [7.66, 81.74],
            [7.64, 81.72], [7.66, 81.68], [7.69, 81.69]
        ],
        description: "Eastern coastal flooding zone around Batticaloa lagoon",
        severity: "High",
        affectedAreas: ["Batticaloa Town", "Lagoon settlements"],
        timestamp: new Date().toISOString()
    },
    {
        id: 7,
        name: "Trincomalee Bay Area",
        riskLevel: "medium",
        type: "flood",
        coordinates: [
            [8.57, 81.23], [8.55, 81.25], [8.53, 81.27],
            [8.51, 81.25], [8.53, 81.21], [8.56, 81.22]
        ],
        description: "Coastal flooding risk in Trincomalee natural harbor area",
        severity: "Medium",
        affectedAreas: ["Trincomalee City", "Port areas"],
        timestamp: new Date().toISOString()
    },
    {
        id: 8,
        name: "Maha Oya River Basin",
        riskLevel: "medium",
        type: "flood",
        coordinates: [
            [7.55, 81.25], [7.53, 81.27], [7.51, 81.29],
            [7.49, 81.27], [7.51, 81.23], [7.54, 81.24]
        ],
        description: "River flooding in Maha Oya basin during heavy monsoon",
        severity: "Medium",
        affectedAreas: ["Ampara District", "Agricultural lands"],
        timestamp: new Date().toISOString()
    },
    {
        id: 9,
        name: "Kalu Ganga Basin",
        riskLevel: "high",
        type: "flood",
        coordinates: [
            [6.65, 80.15], [6.63, 80.17], [6.61, 80.19],
            [6.59, 80.17], [6.61, 80.13], [6.64, 80.14]
        ],
        description: "Severe flooding in Kalu Ganga river basin",
        severity: "High",
        affectedAreas: ["Ratnapura District", "Rural settlements"],
        timestamp: new Date().toISOString()
    },
    {
        id: 10,
        name: "Walawe River Basin",
        riskLevel: "medium",
        type: "flood",
        coordinates: [
            [6.35, 80.85], [6.33, 80.87], [6.31, 80.89],
            [6.29, 80.87], [6.31, 80.83], [6.34, 80.84]
        ],
        description: "Flood risk in Walawe river basin affecting agricultural areas",
        severity: "Medium",
        affectedAreas: ["Hambantota District", "Farmlands"],
        timestamp: new Date().toISOString()
    }
];

// Sri Lanka Risk Data - Landslide Risk Zones
const landslideRiskZones = [
    {
        id: 1,
        name: "Kandy Hill Country",
        riskLevel: "medium",
        type: "landslide",
        coordinates: [
            [7.25, 80.60], [7.23, 80.65], [7.21, 80.68],
            [7.19, 80.65], [7.21, 80.58], [7.24, 80.55]
        ],
        description: "Hilly areas around Kandy with landslide risk during heavy rains",
        severity: "Medium",
        affectedAreas: ["Kandy City", "Surrounding hills"],
        timestamp: new Date().toISOString()
    },
    {
        id: 2,
        name: "Badulla District",
        riskLevel: "medium",
        type: "landslide",
        coordinates: [
            [6.95, 81.05], [6.93, 81.08], [6.91, 81.12],
            [6.89, 81.08], [6.91, 81.02], [6.94, 81.00]
        ],
        description: "Mountainous areas in Badulla district prone to landslides",
        severity: "Medium",
        affectedAreas: ["Badulla Town", "Uva Province hills"],
        timestamp: new Date().toISOString()
    },
    {
        id: 3,
        name: "Nuwara Eliya Landslide Zone",
        riskLevel: "high",
        type: "landslide",
        coordinates: [
            [6.93, 80.75], [6.91, 80.78], [6.89, 80.82],
            [6.87, 80.78], [6.89, 80.72], [6.92, 80.70]
        ],
        description: "Very high landslide risk in Nuwara Eliya hills",
        severity: "High",
        affectedAreas: ["Nuwara Eliya", "Tea plantations"],
        timestamp: new Date().toISOString()
    },
    {
        id: 4,
        name: "Rathnapura Critical Zone",
        riskLevel: "high",
        type: "landslide",
        coordinates: [
            [6.65, 80.35], [6.63, 80.38], [6.61, 80.42],
            [6.59, 80.38], [6.61, 80.32], [6.64, 80.30]
        ],
        description: "Critical risk area in Rathnapura due to mining activities",
        severity: "High",
        affectedAreas: ["Rathnapura City", "Gem mining areas"],
        timestamp: new Date().toISOString()
    },
    {
        id: 5,
        name: "Ella Rock Area",
        riskLevel: "high",
        type: "landslide",
        coordinates: [
            [6.85, 81.05], [6.83, 81.07], [6.81, 81.09],
            [6.79, 81.07], [6.81, 81.03], [6.84, 81.04]
        ],
        description: "Steep slopes around Ella with high landslide potential",
        severity: "High",
        affectedAreas: ["Ella Town", "Hiking trails"],
        timestamp: new Date().toISOString()
    },
    {
        id: 6,
        name: "Hatton Mountain Roads",
        riskLevel: "medium",
        type: "landslide",
        coordinates: [
            [6.90, 80.60], [6.88, 80.62], [6.86, 80.64],
            [6.84, 80.62], [6.86, 80.58], [6.89, 80.59]
        ],
        description: "Mountain roads in Hatton area prone to landslides",
        severity: "Medium",
        affectedAreas: ["Hatton Town", "Main roads to plantations"],
        timestamp: new Date().toISOString()
    },
    {
        id: 7,
        name: "Haputale Hills",
        riskLevel: "high",
        type: "landslide",
        coordinates: [
            [6.77, 80.95], [6.75, 80.97], [6.73, 80.99],
            [6.71, 80.97], [6.73, 80.93], [6.76, 80.94]
        ],
        description: "Steep hills in Haputale with frequent landslide incidents",
        severity: "High",
        affectedAreas: ["Haputale Town", "Mountain villages"],
        timestamp: new Date().toISOString()
    },
    {
        id: 8,
        name: "Diyaluma Falls Area",
        riskLevel: "medium",
        type: "landslide",
        coordinates: [
            [6.82, 81.00], [6.80, 81.02], [6.78, 81.04],
            [6.76, 81.02], [6.78, 80.98], [6.81, 80.99]
        ],
        description: "Landslide risk around Diyaluma Falls and surrounding cliffs",
        severity: "Medium",
        affectedAreas: ["Koslanda area", "Waterfall vicinity"],
        timestamp: new Date().toISOString()
    },
    {
        id: 9,
        name: "Knuckles Mountain Range",
        riskLevel: "high",
        type: "landslide",
        coordinates: [
            [7.40, 80.80], [7.38, 80.82], [7.36, 80.84],
            [7.34, 80.82], [7.36, 80.78], [7.39, 80.79]
        ],
        description: "High landslide risk in Knuckles Conservation Area",
        severity: "High",
        affectedAreas: ["Knuckles Range", "Trekking paths"],
        timestamp: new Date().toISOString()
    },
    {
        id: 10,
        name: "Piduruthalagala Slope",
        riskLevel: "medium",
        type: "landslide",
        coordinates: [
            [7.00, 80.77], [6.98, 80.79], [6.96, 80.81],
            [6.94, 80.79], [6.96, 80.75], [6.99, 80.76]
        ],
        description: "Slopes of Piduruthalagala mountain with landslide risk",
        severity: "Medium",
        affectedAreas: ["Nuwara Eliya District", "Mountain roads"],
        timestamp: new Date().toISOString()
    }
];

// Sri Lanka Risk Data - High Risk Areas (Avoid)
const highRiskZones = [
    {
        id: 1,
        name: "Matara Coastal Flood Zone",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [5.95, 80.53], [5.93, 80.55], [5.91, 80.57],
            [5.89, 80.55], [5.91, 80.51], [5.94, 80.52]
        ],
        description: "Severe coastal flooding risk in Matara - AVOID DURING MONSOON",
        severity: "Critical",
        affectedAreas: ["Matara City", "Coastal highways"],
        timestamp: new Date().toISOString()
    },
    {
        id: 2,
        name: "Hambantota Storm Surge Zone",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [6.12, 81.10], [6.10, 81.12], [6.08, 81.14],
            [6.06, 81.12], [6.08, 81.08], [6.11, 81.09]
        ],
        description: "Storm surge and coastal flooding risk area - EVACUATION ZONE",
        severity: "Critical",
        affectedAreas: ["Hambantota Port", "Coastal areas"],
        timestamp: new Date().toISOString()
    },
    {
        id: 3,
        name: "Kegalle Landslide Zone",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [7.20, 80.35], [7.18, 80.37], [7.16, 80.39],
            [7.14, 80.37], [7.16, 80.33], [7.19, 80.34]
        ],
        description: "High landslide risk area in Kegalle district - DANGEROUS AREA",
        severity: "Critical",
        affectedAreas: ["Kegalle Town", "Mountain roads"],
        timestamp: new Date().toISOString()
    },
    {
        id: 4,
        name: "Ampara Flood Plains",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [7.30, 81.65], [7.28, 81.67], [7.26, 81.69],
            [7.24, 81.67], [7.26, 81.63], [7.29, 81.64]
        ],
        description: "High flood risk in Ampara agricultural areas - NO TRAVEL ZONE",
        severity: "Critical",
        affectedAreas: ["Ampara District", "Agricultural lands"],
        timestamp: new Date().toISOString()
    },
    {
        id: 5,
        name: "Arugam Bay Critical Zone",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [6.85, 81.83], [6.83, 81.85], [6.81, 81.87],
            [6.79, 81.85], [6.81, 81.81], [6.84, 81.82]
        ],
        description: "Extreme coastal erosion and flooding risk - TOURIST EVACUATION ZONE",
        severity: "Critical",
        affectedAreas: ["Arugam Bay", "Surfing beaches"],
        timestamp: new Date().toISOString()
    },
    {
        id: 6,
        name: "Yala National Park Buffer",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [6.40, 81.40], [6.38, 81.42], [6.36, 81.44],
            [6.34, 81.42], [6.36, 81.38], [6.39, 81.39]
        ],
        description: "Wildlife conflict and flooding risk - RESTRICTED ACCESS",
        severity: "Critical",
        affectedAreas: ["Yala Park borders", "Buffer zones"],
        timestamp: new Date().toISOString()
    },
    {
        id: 7,
        name: "Wilpattu Flood Basin",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [8.25, 80.05], [8.23, 80.07], [8.21, 80.09],
            [8.19, 80.07], [8.21, 80.03], [8.24, 80.04]
        ],
        description: "Severe seasonal flooding in Wilpattu national park area",
        severity: "Critical",
        affectedAreas: ["Wilpattu Park", "Surrounding villages"],
        timestamp: new Date().toISOString()
    },
    {
        id: 8,
        name: "Mannar Coastal Strip",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [8.98, 79.90], [8.96, 79.92], [8.94, 79.94],
            [8.92, 79.92], [8.94, 79.88], [8.97, 79.89]
        ],
        description: "Coastal storm surge and erosion risk - HIGH ALERT ZONE",
        severity: "Critical",
        affectedAreas: ["Mannar Island", "Coastal settlements"],
        timestamp: new Date().toISOString()
    },
    {
        id: 9,
        name: "Jaffna Peninsula Lowlands",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [9.65, 80.00], [9.63, 80.02], [9.61, 80.04],
            [9.59, 80.02], [9.61, 79.98], [9.64, 79.99]
        ],
        description: "Saltwater intrusion and coastal flooding - CRITICAL ZONE",
        severity: "Critical",
        affectedAreas: ["Jaffna City", "Peninsula lowlands"],
        timestamp: new Date().toISOString()
    },
    {
        id: 10,
        name: "Adams Peak Pilgrim Route",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [6.82, 80.50], [6.80, 80.52], [6.78, 80.54],
            [6.76, 80.52], [6.78, 80.48], [6.81, 80.49]
        ],
        description: "Extreme landslide risk during pilgrimage season - AVOID COMPLETELY",
        severity: "Critical",
        affectedAreas: ["Adam's Peak", "Pilgrim trails"],
        timestamp: new Date().toISOString()
    },
    {
        id: 11,
        name: "Sinharaja Forest Border",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [6.40, 80.45], [6.38, 80.47], [6.36, 80.49],
            [6.34, 80.47], [6.36, 80.43], [6.39, 80.44]
        ],
        description: "Flash flood and landslide risk in rainforest border areas",
        severity: "Critical",
        affectedAreas: ["Sinharaja Forest", "Buffer zones"],
        timestamp: new Date().toISOString()
    },
    {
        id: 12,
        name: "Puttalam Salt Marshes",
        riskLevel: "high",
        type: "high-risk",
        coordinates: [
            [8.05, 79.80], [8.03, 79.82], [8.01, 79.84],
            [7.99, 79.82], [8.01, 79.78], [8.04, 79.79]
        ],
        description: "Tidal flooding and saltwater intrusion - NO ACCESS ZONE",
        severity: "Critical",
        affectedAreas: ["Puttalam Lagoon", "Salt pan areas"],
        timestamp: new Date().toISOString()
    }
];