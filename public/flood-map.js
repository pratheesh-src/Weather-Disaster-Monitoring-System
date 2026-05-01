// Sri Lanka Flood & Landslide Route Planning
let map;
let routingControl;
let floodRiskZones = [];
let landslideRiskZones = [];
let highRiskZones = [];
let currentMarkers = [];
let userLocation = null;

// Initialize map centered on Sri Lanka
function initMap() {
    // Center on Sri Lanka
    map = L.map('map').setView([7.8731, 80.7718], 8);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Load Sri Lanka risk data
    loadSriLankaRiskData();
    
    // Add click event for setting points
    map.on('click', function(e) {
        const latlng = e.latlng;
        addMarker(latlng, `Location: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`);
    });
}

// Load Sri Lanka-specific risk data with MORE AREAS
function loadSriLankaRiskData() {
    // FLOOD PRONE AREAS (BLUE) - MORE AREAS ADDED
    floodRiskZones = [
        {
            id: 1,
            name: "Colombo Flood Zone",
            riskLevel: "medium",
            type: "flood",
            coordinates: [
                [6.927, 79.85], [6.917, 79.86], [6.907, 79.87], 
                [6.897, 79.85], [6.907, 79.83], [6.927, 79.84]
            ],
            description: "Low-lying areas in Colombo prone to flooding",
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
            description: "Coastal flooding areas in Kalutara",
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
            timestamp: new Date().toISOString()
        },
        {
            id: 4,
            name: "Negombo Lagoon Area",
            riskLevel: "medium",
            type: "flood",
            coordinates: [
                [7.20, 79.83], [7.18, 79.85], [7.16, 79.87],
                [7.14, 79.85], [7.16, 79.81], [7.19, 79.82]
            ],
            description: "Areas around Negombo lagoon prone to flooding",
            timestamp: new Date().toISOString()
        },
        {
            id: 5,
            name: "Batticaloa Coastal Belt",
            riskLevel: "medium",
            type: "flood",
            coordinates: [
                [7.75, 81.68], [7.73, 81.70], [7.71, 81.72],
                [7.69, 81.70], [7.71, 81.66], [7.74, 81.67]
            ],
            description: "Coastal flooding in Batticaloa district",
            timestamp: new Date().toISOString()
        }
    ];

    // LANDSLIDE RISK ZONES (ORANGE) - MORE AREAS ADDED
    landslideRiskZones = [
        {
            id: 1,
            name: "Kandy Hill Country",
            riskLevel: "medium",
            type: "landslide",
            coordinates: [
                [7.25, 80.60], [7.23, 80.65], [7.21, 80.68],
                [7.19, 80.65], [7.21, 80.58], [7.24, 80.55]
            ],
            description: "Hilly areas around Kandy with landslide risk",
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
            description: "Mountainous areas in Badulla district",
            timestamp: new Date().toISOString()
        },
        {
            id: 3,
            name: "Haputale Hills",
            riskLevel: "medium",
            type: "landslide",
            coordinates: [
                [6.77, 80.95], [6.75, 80.97], [6.73, 81.00],
                [6.71, 80.97], [6.73, 80.93], [6.76, 80.94]
            ],
            description: "Steep hills in Haputale area",
            timestamp: new Date().toISOString()
        },
        {
            id: 4,
            name: "Ella Region",
            riskLevel: "medium",
            type: "landslide",
            coordinates: [
                [6.87, 81.05], [6.85, 81.07], [6.83, 81.09],
                [6.81, 81.07], [6.83, 81.03], [6.86, 81.04]
            ],
            description: "Popular tourist area with landslide risks",
            timestamp: new Date().toISOString()
        },
        {
            id: 5,
            name: "Hatton Mountain Range",
            riskLevel: "medium",
            type: "landslide",
            coordinates: [
                [6.90, 80.55], [6.88, 80.57], [6.86, 80.59],
                [6.84, 80.57], [6.86, 80.53], [6.89, 80.54]
            ],
            description: "Mountainous areas around Hatton",
            timestamp: new Date().toISOString()
        }
    ];

    // HIGH RISK AREAS (RED) - MORE AREAS ADDED
    highRiskZones = [
        {
            id: 1,
            name: "Kelani River Flood Zone",
            riskLevel: "high",
            type: "high-risk",
            coordinates: [
                [6.96, 80.08], [6.94, 80.12], [6.92, 80.15],
                [6.90, 80.12], [6.92, 80.08], [6.95, 80.05]
            ],
            description: "Extreme flood risk area in Kelani River basin",
            timestamp: new Date().toISOString()
        },
        {
            id: 2,
            name: "Nuwara Eliya Landslide Zone",
            riskLevel: "high",
            type: "high-risk",
            coordinates: [
                [6.93, 80.75], [6.91, 80.78], [6.89, 80.82],
                [6.87, 80.78], [6.89, 80.72], [6.92, 80.70]
            ],
            description: "Very high landslide risk in Nuwara Eliya hills",
            timestamp: new Date().toISOString()
        },
        {
            id: 3,
            name: "Rathnapura Critical Zone",
            riskLevel: "high",
            type: "high-risk",
            coordinates: [
                [6.65, 80.35], [6.63, 80.38], [6.61, 80.42],
                [6.59, 80.38], [6.61, 80.32], [6.64, 80.30]
            ],
            description: "Critical risk area in Rathnapura due to mining activities",
            timestamp: new Date().toISOString()
        },
        {
            id: 4,
            name: "Matara Coastal Flood Zone",
            riskLevel: "high",
            type: "high-risk",
            coordinates: [
                [5.95, 80.53], [5.93, 80.55], [5.91, 80.57],
                [5.89, 80.55], [5.91, 80.51], [5.94, 80.52]
            ],
            description: "Severe coastal flooding risk in Matara",
            timestamp: new Date().toISOString()
        },
        {
            id: 5,
            name: "Ampara Flood Plains",
            riskLevel: "high",
            type: "high-risk",
            coordinates: [
                [7.30, 81.65], [7.28, 81.67], [7.26, 81.69],
                [7.24, 81.67], [7.26, 81.63], [7.29, 81.64]
            ],
            description: "High flood risk in Ampara agricultural areas",
            timestamp: new Date().toISOString()
        },
        {
            id: 6,
            name: "Hambantota Storm Surge Zone",
            riskLevel: "high",
            type: "high-risk",
            coordinates: [
                [6.12, 81.10], [6.10, 81.12], [6.08, 81.14],
                [6.06, 81.12], [6.08, 81.08], [6.11, 81.09]
            ],
            description: "Storm surge and coastal flooding risk area",
            timestamp: new Date().toISOString()
        },
        {
            id: 7,
            name: "Kegalle Landslide Zone",
            riskLevel: "high",
            type: "high-risk",
            coordinates: [
                [7.20, 80.35], [7.18, 80.37], [7.16, 80.39],
                [7.14, 80.37], [7.16, 80.33], [7.19, 80.34]
            ],
            description: "High landslide risk area in Kegalle district",
            timestamp: new Date().toISOString()
        },
        {
            id: 8,
            name: "Trincomalee Bay Area",
            riskLevel: "high",
            type: "high-risk",
            coordinates: [
                [8.58, 81.23], [8.56, 81.25], [8.54, 81.27],
                [8.52, 81.25], [8.54, 81.21], [8.57, 81.22]
            ],
            description: "Tsunami and storm surge risk area",
            timestamp: new Date().toISOString()
        }
    ];

    renderRiskZones();
}

// RENDER ALL 3 TYPES SEPARATELY
function renderRiskZones() {
    // Clear existing zones
    map.eachLayer(layer => {
        if (layer instanceof L.Polygon) {
            map.removeLayer(layer);
        }
    });

    // 1. Render FLOOD ZONES (BLUE)
    floodRiskZones.forEach(zone => {
        const polygon = L.polygon(zone.coordinates, {
            color: '#3498db',        // BLUE
            fillColor: '#3498db',    // BLUE
            fillOpacity: 0.5,
            weight: 2,
            opacity: 0.7
        }).addTo(map);
        
        polygon.bindPopup(`
            <div style="min-width: 250px;">
                <h3>🌊 ${zone.name}</h3>
                <p><strong>Type:</strong> Flood Prone Area</p>
                <p><strong>Risk Level:</strong> <span style="color: #3498db">MEDIUM</span></p>
                <p><strong>Description:</strong> ${zone.description}</p>
                <p><strong>Warning:</strong> May flood during heavy rainfall</p>
            </div>
        `);
    });

    // 2. Render LANDSLIDE ZONES (ORANGE)
    landslideRiskZones.forEach(zone => {
        const polygon = L.polygon(zone.coordinates, {
            color: '#f39c12',       // ORANGE
            fillColor: '#f39c12',   // ORANGE
            fillOpacity: 0.5,
            weight: 2,
            opacity: 0.7
        }).addTo(map);
        
        polygon.bindPopup(`
            <div style="min-width: 250px;">
                <h3>⛰️ ${zone.name}</h3>
                <p><strong>Type:</strong> Landslide Risk Zone</p>
                <p><strong>Risk Level:</strong> <span style="color: #f39c12">MEDIUM</span></p>
                <p><strong>Description:</strong> ${zone.description}</p>
                <p><strong>Warning:</strong> Landslide risk during heavy rains</p>
            </div>
        `);
    });

    // 3. Render HIGH RISK ZONES (RED)
    highRiskZones.forEach(zone => {
        const polygon = L.polygon(zone.coordinates, {
            color: '#e74c3c',       // RED
            fillColor: '#e74c3c',   // RED
            fillOpacity: 0.6,
            weight: 3,
            opacity: 0.8
        }).addTo(map);
        
        polygon.bindPopup(`
            <div style="min-width: 250px;">
                <h3>🚨 ${zone.name}</h3>
                <p><strong>Type:</strong> High Risk Area</p>
                <p><strong>Risk Level:</strong> <span style="color: #e74c3c; font-weight: bold;">HIGH</span></p>
                <p><strong>Description:</strong> ${zone.description}</p>
                <p><strong>Warning:</strong> 🚨 AVOID THIS AREA COMPLETELY</p>
            </div>
        `);
    });
}

// Get user's current location
function getCurrentLocation() {
    const statusPanel = document.getElementById('routeStatus');
    
    if (!navigator.geolocation) {
        statusPanel.innerHTML = '<strong>Route Status:</strong> ❌ Geolocation is not supported by this browser';
        statusPanel.classList.add('alert');
        return;
    }

    statusPanel.innerHTML = '<strong>Route Status:</strong> 🔄 Detecting your location...';
    statusPanel.classList.remove('alert');

    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            userLocation = { lat, lng };
            
            // Set as start point
            document.getElementById('startPoint').value = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            
            // Add marker and center map
            addMarker({ lat, lng }, '<strong>Your Current Location</strong>');
            map.setView([lat, lng], 13);
            
            statusPanel.innerHTML = `<strong>Route Status:</strong> ✅ Location detected`;
        },
        function(error) {
            let errorMessage = 'Unable to retrieve your location';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access denied. Please allow location access.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'Location request timed out.';
                    break;
            }
            statusPanel.innerHTML = `<strong>Route Status:</strong> ❌ ${errorMessage}`;
            statusPanel.classList.add('alert');
        }
    );
}

// Add marker to map
function addMarker(latlng, popupText) {
    const marker = L.marker(latlng).addTo(map)
        .bindPopup(popupText)
        .openPopup();
    
    currentMarkers.push(marker);
    return marker;
}

// Find safe route avoiding risk zones
function findSafeRoute() {
    const startInput = document.getElementById('startPoint').value;
    const endInput = document.getElementById('endPoint').value;
    const statusPanel = document.getElementById('routeStatus');
    
    if (!startInput || !endInput) {
        statusPanel.innerHTML = '<strong>Route Status:</strong> ❌ Please enter both start and end points';
        statusPanel.classList.add('alert');
        return;
    }

    try {
        const startCoords = parseCoordinates(startInput);
        const endCoords = parseCoordinates(endInput);

        // Clear existing route and markers
        clearRoute();

        // Add markers for start and end points
        addMarker(startCoords, '<strong>Start Point</strong>');
        addMarker(endCoords, '<strong>End Point</strong>');

        // Create route
        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(startCoords.lat, startCoords.lng),
                L.latLng(endCoords.lat, endCoords.lng)
            ],
            routeWhileDragging: false,
            showAlternatives: false,
            lineOptions: {
                styles: [
                    {
                        color: '#27ae60',
                        opacity: 0.8,
                        weight: 6
                    }
                ]
            },
            createMarker: function() { return null; },
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1'
            })
        }).addTo(map);

        routingControl.on('routesfound', function(e) {
            const routes = e.routes;
            const route = routes[0];
            
            // Check route safety against ALL zones
            const safetyCheck = checkRouteSafety(route);
            
            if (safetyCheck.safe) {
                statusPanel.innerHTML = `<strong>Route Status:</strong> ✅ Safe route found (${(route.summary.totalDistance / 1000).toFixed(1)} km, ${Math.round(route.summary.totalTime / 60)} min)`;
                statusPanel.classList.remove('alert');
            } else {
                let warningMessage = `<strong>Route Status:</strong> ⚠️ Route passes through:`;
                if (safetyCheck.highRiskZones.length > 0) {
                    warningMessage += `<br>🚨 ${safetyCheck.highRiskZones.length} high risk zone(s)`;
                }
                if (safetyCheck.floodZones.length > 0) {
                    warningMessage += `<br>🌊 ${safetyCheck.floodZones.length} flood zone(s)`;
                }
                if (safetyCheck.landslideZones.length > 0) {
                    warningMessage += `<br>⛰️ ${safetyCheck.landslideZones.length} landslide zone(s)`;
                }
                warningMessage += `<br>Consider alternative routes`;
                
                statusPanel.innerHTML = warningMessage;
                statusPanel.classList.add('alert');
            }
        });

        routingControl.on('routingerror', function(e) {
            statusPanel.innerHTML = '<strong>Route Status:</strong> ❌ Could not calculate route. Please check coordinates.';
            statusPanel.classList.add('alert');
        });

        statusPanel.innerHTML = '<strong>Route Status:</strong> 🔄 Calculating route...';
        statusPanel.classList.remove('alert');

    } catch (error) {
        statusPanel.innerHTML = '<strong>Route Status:</strong> ❌ Invalid coordinates format. Use: lat,lng';
        statusPanel.classList.add('alert');
    }
}

// Parse coordinate input
function parseCoordinates(input) {
    const coords = input.split(',').map(coord => parseFloat(coord.trim()));
    if (coords.length !== 2 || coords.some(isNaN)) {
        throw new Error('Invalid coordinates');
    }
    return { lat: coords[0], lng: coords[1] };
}

// Check if route passes through risk zones
function checkRouteSafety(route) {
    const floodZones = [];
    const landslideZones = [];
    const highRiskZonesFound = [];
    
    const allZones = [...floodRiskZones, ...landslideRiskZones, ...highRiskZones];
    
    // Sample points along the route
    route.coordinates.forEach(coord => {
        allZones.forEach(zone => {
            if (isPointInPolygon([coord.lat, coord.lng], zone.coordinates)) {
                if (zone.type === 'flood' && !floodZones.includes(zone.name)) {
                    floodZones.push(zone.name);
                }
                if (zone.type === 'landslide' && !landslideZones.includes(zone.name)) {
                    landslideZones.push(zone.name);
                }
                if (zone.type === 'high-risk' && !highRiskZonesFound.includes(zone.name)) {
                    highRiskZonesFound.push(zone.name);
                }
            }
        });
    });

    return {
        safe: floodZones.length === 0 && landslideZones.length === 0 && highRiskZonesFound.length === 0,
        floodZones: floodZones,
        landslideZones: landslideZones,
        highRiskZones: highRiskZonesFound
    };
}

// Simple point-in-polygon check
function isPointInPolygon(point, polygon) {
    const x = point[0], y = point[1];
    let inside = false;
    
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    
    return inside;
}

// Clear current route and markers
function clearRoute() {
    if (routingControl) {
        map.removeControl(routingControl);
        routingControl = null;
    }
    
    // Clear markers
    currentMarkers.forEach(marker => map.removeLayer(marker));
    currentMarkers = [];
    
    document.getElementById('routeStatus').innerHTML = '<strong>Route Status:</strong> Ready to calculate route';
    document.getElementById('routeStatus').classList.remove('alert');
}

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});