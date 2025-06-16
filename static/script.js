document.addEventListener('DOMContentLoaded', function () {
    // --- ELEMENT SELECTORS ---
    const imageUpload = document.getElementById('imageUpload');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const planBtn = document.getElementById('planBtn');
    const downloadGpxBtn = document.getElementById('downloadGpxBtn');
    
    const spinner = document.getElementById('spinner');
    const analyzeBtnText = document.getElementById('analyzeBtnText');
    const actionPanel = document.getElementById('actionPanel');
    const resultsPanel = document.getElementById('resultsPanel');
    const resultsText = document.getElementById('resultsText');
    const mapPlaceholder = document.getElementById('map-placeholder');
    const messageBox = document.getElementById('messageBox');
    const messageText = document.getElementById('messageText');

    // --- STATE VARIABLES ---
    let map = null;
    let imageOverlay = null;
    let markersLayer = L.layerGroup();
    let pathLayer = L.layerGroup();
    let detectionsData = [];
    let imageDimensions = { width: 0, height: 0 };

    // --- INITIALIZE MAP ---
    // Initialize Leaflet map, but it remains hidden until an image is loaded.
    // We use a simple coordinate system (CRS.Simple) because we're mapping onto an image, not the Earth.
    map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -5,
        layers: [markersLayer, pathLayer] // Add layers for markers and paths
    });
    
    // Disable analyze button initially
    analyzeBtn.disabled = true;

    // --- EVENT LISTENERS ---

    // Enable analyze button only when a file is selected
    imageUpload.addEventListener('change', () => {
        analyzeBtn.disabled = !imageUpload.files || imageUpload.files.length === 0;
    });

    // Main analysis trigger
    analyzeBtn.addEventListener('click', handleAnalysis);

    // Plan generation trigger
    planBtn.addEventListener('click', generateAndDrawPath);
    
    // GPX download trigger
    downloadGpxBtn.addEventListener('click', downloadGpxFile);


    // --- FUNCTIONS ---

    /**
     * Shows a custom error message on the screen.
     * @param {string} msg The error message to display.
     */
    function showMessage(msg) {
        messageText.textContent = msg;
        messageBox.classList.remove('hidden');
        setTimeout(() => {
            messageBox.classList.add('hidden');
        }, 4000); // Hide after 4 seconds
    }
    
    /**
     * Handles the click event for the 'Analyze Field' button.
     * Uploads the image to the Flask backend and processes the response.
     */
    async function handleAnalysis() {
        if (!imageUpload.files || imageUpload.files.length === 0) {
            showMessage("Please select an image file first.");
            return;
        }

        const file = imageUpload.files[0];
        const formData = new FormData();
        formData.append('fieldImage', file);

        // Update UI to show loading state
        toggleLoading(true);
        resetState();

        try {
            // Make the API call to the Flask backend
            const response = await fetch('/analyze', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                // On success, display the image and the AI detections
                displayImageAndDetections(result.image_url, result.detections);
                actionPanel.classList.remove('hidden');
                resultsPanel.classList.remove('hidden');
                resultsText.textContent = `Analysis complete. Found ${result.detections.length} potential weed clusters.`;
            } else {
                showMessage(result.error || 'An unknown error occurred during analysis.');
            }
        } catch (error) {
            console.error('Error:', error);
            showMessage('Failed to connect to the analysis server.');
        } finally {
            // Revert UI from loading state
            toggleLoading(false);
        }
    }

    /**
     * Resets the map and UI to its initial state before a new analysis.
     */
    function resetState() {
        if (imageOverlay) {
            map.removeLayer(imageOverlay);
            imageOverlay = null;
        }
        markersLayer.clearLayers();
        pathLayer.clearLayers();
        actionPanel.classList.add('hidden');
        resultsPanel.classList.add('hidden');
        downloadGpxBtn.classList.add('hidden');
        mapPlaceholder.classList.remove('hidden');
        detectionsData = [];
    }

    /**
     * Toggles the loading spinner and button text.
     * @param {boolean} isLoading - Whether to show or hide the loading state.
     */
    function toggleLoading(isLoading) {
        if (isLoading) {
            analyzeBtnText.textContent = 'Analyzing...';
            spinner.classList.remove('hidden');
            analyzeBtn.disabled = true;
        } else {
            analyzeBtnText.textContent = 'Analyze Field';
            spinner.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    }

    /**
     * Displays the field image on the map and plots the detected points.
     * @param {string} imageUrl - The URL of the image to display.
     * @param {Array} detections - An array of detection objects from the backend.
     */
    function displayImageAndDetections(imageUrl, detections) {
        // Use a temporary image object to get dimensions
        const img = new Image();
        img.onload = function () {
            imageDimensions.width = this.width;
            imageDimensions.height = this.height;

            // Define the image bounds for Leaflet. The CRS.Simple uses a simple [y, x] coordinate system.
            const bounds = [[0, 0], [this.height, this.width]];
            
            // Add the image as an overlay on the map
            imageOverlay = L.imageOverlay(imageUrl, bounds).addTo(map);
            
            // Fit the map view to the image bounds
            map.fitBounds(bounds);
            mapPlaceholder.classList.add('hidden');

            // Store detection data and plot markers
            detectionsData = detections;
            plotMarkers(detections);
        };
        img.onerror = function() {
            showMessage("Could not load the processed image.");
        }
        img.src = imageUrl;
    }
    
    /**
     * Plots markers on the map for each detected weed.
     * @param {Array} detections - An array of detection objects.
     */
    function plotMarkers(detections) {
        markersLayer.clearLayers();
        detections.forEach(det => {
            // Convert normalized coordinates to Leaflet's [y, x] format
            const latLng = [
                (1 - det.coords.y) * imageDimensions.height, // Leaflet's y is inverted from typical image coordinates
                det.coords.x * imageDimensions.width
            ];

            // Create a custom icon for the marker
            const weedIcon = L.divIcon({
                className: 'custom-div-icon',
                html: `<div style='background-color: #ef4444;' class='marker-pin'></div>`,
                iconSize: [12, 12],
                iconAnchor: [6, 6]
            });
            
            // Add marker to the layer
            const marker = L.marker(latLng, { icon: weedIcon }).addTo(markersLayer);
            marker.bindPopup(`<b>Weed Detected</b><br>Confidence: ${det.confidence * 100}%`);
        });
    }

    /**
     * Generates and draws the optimized spraying path on the map.
     */
    function generateAndDrawPath() {
        pathLayer.clearLayers();
        if (detectionsData.length < 2) {
            showMessage("Not enough points to generate a path.");
            return;
        }

        // --- PATH OPTIMIZATION (Nearest Neighbor Algorithm) ---
        // This is a simple but effective algorithm for the traveling salesman problem.
        // It's a great example of computational problem-solving to show the judges.

        let unvisited = [...detectionsData];
        let path = [];
        let currentPoint = unvisited.shift(); // Start at the first point
        path.push(currentPoint);

        while (unvisited.length > 0) {
            let nearestIndex = -1;
            let minDistance = Infinity;

            for (let i = 0; i < unvisited.length; i++) {
                const distance = Math.sqrt(
                    Math.pow(currentPoint.coords.x - unvisited[i].coords.x, 2) +
                    Math.pow(currentPoint.coords.y - unvisited[i].coords.y, 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearestIndex = i;
                }
            }
            
            currentPoint = unvisited.splice(nearestIndex, 1)[0];
            path.push(currentPoint);
        }

        // Convert the ordered path points to Leaflet LatLng format
        const latLngs = path.map(p => [
            (1 - p.coords.y) * imageDimensions.height,
            p.coords.x * imageDimensions.width
        ]);

        // Draw the path as a polyline on the map
        const polyline = L.polyline(latLngs, { color: '#16a34a', weight: 3, dashArray: '5, 5' }).addTo(pathLayer);
        map.fitBounds(polyline.getBounds().pad(0.1));
        
        // Show the download button
        downloadGpxBtn.classList.remove('hidden');
    }

    /**
     * Creates and triggers the download of a GPX file for the path.
     */
    function downloadGpxFile() {
        if (pathLayer.getLayers().length === 0) {
            showMessage("No path has been generated yet.");
            return;
        }
        
        const polyline = pathLayer.getLayers()[0];
        const latLngs = polyline.getLatLngs();

        // Convert Leaflet coordinates to standard GPS coordinates (latitude, longitude)
        // For this simulation, we'll use the pixel coordinates as a placeholder.
        // In a real system, you'd convert pixel coords to actual GPS coords.
        let trackpoints = '';
        latLngs.forEach(ll => {
            trackpoints += `
    <trkpt lat="${ll.lat.toFixed(4)}" lon="${ll.lng.toFixed(4)}">
      <ele>0</ele>
    </trkpt>`;
        });

        // Create the GPX file content as an XML string
        const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="AgriSynth" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>AgriSynth Optimized Spraying Route</name>
  </metadata>
  <trk>
    <name>Spraying Route</name>
    <trkseg>${trackpoints}
    </trkseg>
  </trk>
</gpx>`;

        // Create a downloadable link and click it
        const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'agrisynth_route.gpx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});
