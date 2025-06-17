// --- Global DOM Element References ---
const spinner = document.getElementById('spinner');
const statusText = document.getElementById('status-text');
const dashboard = document.getElementById('dashboard');

// Input elements
const locationInput = document.getElementById('locationInput');
const cropSelect = document.getElementById('cropSelect');
const panelSelect = document.getElementById('panelSelect');
const sandInput = document.getElementById('sand-input');
const siltInput = document.getElementById('silt-input');
const clayInput = document.getElementById('clay-input');


// Output elements
const energyResult = document.getElementById('energyResult');
const yieldResult = document.getElementById('yieldResult');
const waterResult = document.getElementById('waterResult');
const costResult = document.getElementById('costResult');
const revenueResult = document.getElementById('revenueResult');
const paybackResult = document.getElementById('paybackResult');
const locationDisplay = document.getElementById('location-display');
const locationNameDisplay = document.getElementById('location-name-display');
const irradianceDisplay = document.getElementById('irradiance-display');

// Modal Elements
const versionBtn = document.getElementById('version-btn');
const versionModal = document.getElementById('version-modal');
const closeModalBtn = document.getElementById('close-modal-btn');


// --- State Management ---
let soilComposition = {
    sand: parseInt(sandInput.value),
    silt: parseInt(siltInput.value),
    clay: parseInt(clayInput.value)
};
let simulationTimeout;

// --- Main Simulation Trigger ---
function triggerSimulation() {
    clearTimeout(simulationTimeout);
    statusText.textContent = '...';
    spinner.classList.remove('hidden');

    simulationTimeout = setTimeout(() => {
        if (locationInput.value.trim() === '') {
            statusText.textContent = 'ENTER LOCATION TO BEGIN';
            spinner.classList.add('hidden');
            return;
        }
        runSimulation();
    }, 800); // Debounce: wait 800ms after user stops typing
}

async function runSimulation() {
    statusText.textContent = 'FETCHING DATA...';
    spinner.classList.remove('hidden');

    const simulationData = {
        location: locationInput.value,
        crop: cropSelect.value,
        panel: panelSelect.value,
        soil: soilComposition
    };

    try {
        const response = await fetch('/run_simulation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(simulationData),
        });

        const results = await response.json();

        if(results.error) {
            statusText.textContent = results.error.toUpperCase();
            spinner.classList.add('hidden');
            return;
        }

        if (dashboard.classList.contains('h-0')) {
             dashboard.classList.remove('h-0', 'opacity-0');
             dashboard.classList.add('h-64');
        }
        updateUI(results);

    } catch (error) {
        statusText.textContent = 'SIMULATION FAILED';
    } finally {
        spinner.classList.add('hidden');
    }
}

// --- Event Listeners ---
locationInput.addEventListener('input', triggerSimulation);
cropSelect.addEventListener('change', triggerSimulation);
panelSelect.addEventListener('change', triggerSimulation);


// --- UI Update Function ---
function updateUI(results) {
    locationDisplay.classList.remove('hidden');
    locationNameDisplay.textContent = results.locationData.name;
    irradianceDisplay.textContent = results.locationData.irradiance;

    energyResult.textContent = results.energyGeneratedMWh;
    yieldResult.textContent = results.predictedYieldPercent;
    waterResult.textContent = results.waterSavedPercent;
    costResult.textContent = results.economics.panelCost;
    revenueResult.textContent = results.economics.annualRevenue;
    paybackResult.textContent = results.economics.paybackPeriod;
    renderChart(results.yieldChartData);
    statusText.textContent = 'SYSTEM SIMULATED';
}

// --- Soil Input Logic ---
function handleSoilInput(changedElement) {
    let sand = parseInt(sandInput.value) || 0;
    let silt = parseInt(siltInput.value) || 0;
    let clay = parseInt(clayInput.value) || 0;

    sand = Math.max(0, Math.min(100, sand));
    silt = Math.max(0, Math.min(100, silt));
    clay = Math.max(0, Math.min(100, clay));

    let total = sand + silt + clay;
    if (total > 100) {
        let excess = total - 100;
        if (changedElement === sandInput) {
            let otherTotal = silt + clay;
            if (otherTotal > 0) {
                silt = Math.max(0, silt - Math.round(excess * (silt / otherTotal)));
                clay = Math.max(0, clay - Math.round(excess * (clay / otherTotal)));
            } else {
                sand = 100;
                silt = 0;
                clay = 0;
            }
        } else if (changedElement === siltInput) {
            let otherTotal = sand + clay;
            if (otherTotal > 0) {
                sand = Math.max(0, sand - Math.round(excess * (sand / otherTotal)));
                clay = Math.max(0, clay - Math.round(excess * (clay / otherTotal)));
            } else {
                silt = 100;
                sand = 0;
                clay = 0;
            }
        } else { // clayInput changed
            let otherTotal = sand + silt;
            if (otherTotal > 0) {
                sand = Math.max(0, sand - Math.round(excess * (sand / otherTotal)));
                silt = Math.max(0, silt - Math.round(excess * (silt / otherTotal)));
            } else {
                clay = 100;
                sand = 0;
                silt = 0;
            }
        }
    }

    let finalTotal = sand + silt + clay;
    if (finalTotal !== 100) {
       sand += (100 - finalTotal);
    }

    sandInput.value = sand;
    siltInput.value = silt;
    clayInput.value = clay;

    soilComposition = {sand: parseInt(sandInput.value), silt: parseInt(siltInput.value), clay: parseInt(clayInput.value)};
    triggerSimulation();
}

sandInput.addEventListener('input', () => handleSoilInput(sandInput));
siltInput.addEventListener('input', () => handleSoilInput(siltInput));
clayInput.addEventListener('input', () => handleSoilInput(clayInput));


// --- Tab Navigation, 3D Scene, Chart.js ---
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        tabButtons.forEach(btn => btn.classList.replace('tab-active', 'tab-inactive'));
        button.classList.replace('tab-inactive', 'tab-active');
        tabContents.forEach(content => content.classList.add('hidden'));
        document.getElementById(button.dataset.tab + '-content').classList.remove('hidden');
    });
});
let scene, camera, renderer, farmGroup;
function init3D() {
    const container = document.getElementById('scene-container');
    if (!container) return;
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x1a202c, 50, 150);
    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    farmGroup = new THREE.Group();
    scene.add(farmGroup);
    const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(-30, 50, 20);
    scene.add(directionalLight);
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.9, metalness: 0.1 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    createFarm();
    let isMouseDown = false, prevMouseX = 0, prevMouseY = 0;
    let radius = 35; let horizontalAngle = -Math.PI / 3; let verticalAngle = Math.PI / 4;
    function updateCameraPosition() {
        const x = radius * Math.sin(verticalAngle) * Math.cos(horizontalAngle);
        const y = radius * Math.cos(verticalAngle);
        const z = radius * Math.sin(verticalAngle) * Math.sin(horizontalAngle);
        camera.position.set(x, y, z);
        camera.lookAt(scene.position);
    }
    updateCameraPosition();
    container.addEventListener('mousedown', (e) => { isMouseDown = true; prevMouseX = e.clientX; prevMouseY = e.clientY; });
    container.addEventListener('mouseup', () => { isMouseDown = false; });
    container.addEventListener('mouseleave', () => { isMouseDown = false; });
    container.addEventListener('mousemove', (e) => {
        if (!isMouseDown) return;
        const deltaX = e.clientX - prevMouseX;
        const deltaY = e.clientY - prevMouseY;
        horizontalAngle += deltaX * 0.005;
        verticalAngle -= deltaY * 0.005;
        verticalAngle = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, verticalAngle));
        updateCameraPosition();
        prevMouseX = e.clientX;
        prevMouseY = e.clientY;
    });
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        radius += e.deltaY * 0.05;
        radius = Math.max(15, Math.min(80, radius));
        updateCameraPosition();
    });
    window.addEventListener('resize', () => {
        if (container) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
    animate();
}
function createFarm() {
    while(farmGroup.children.length > 0){ farmGroup.remove(farmGroup.children[0]); }
    const panelConfig = panelSelect.value;
    const crop = cropSelect.value;
    let panelHeight = panelConfig === 'High-Clearance' ? 4 : 2;
    let panelAngle = panelConfig === 'Vertical' ? -Math.PI / 2 : -Math.PI / 6;
    const panelGeo = new THREE.BoxGeometry(2, 0.1, 4);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x0a2244, roughness: 0.2, metalness: 0.9 });
    const postGeo = new THREE.CylinderGeometry(0.1, 0.1, panelHeight, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x718096 });
    let plantGeo; let plantColor;
    switch(crop) {
        case 'Lettuce': plantGeo = new THREE.SphereGeometry(0.3, 8, 6); plantColor = 0x86efac; break;
        case 'Wheat': plantGeo = new THREE.ConeGeometry(0.15, 0.8, 4); plantColor = 0xfacc15; break;
        case 'Corn': plantGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.5, 6); plantColor = 0x4ade80; break;
        case 'Tomatoes': plantGeo = new THREE.SphereGeometry(0.4, 8, 6); plantColor = 0xef4444; break;
        default: plantGeo = new THREE.SphereGeometry(0.3, 8, 6); plantColor = 0x86efac;
    }
    const plantMat = new THREE.MeshStandardMaterial({color: plantColor, roughness: 0.8});
    const rows = 10, cols = 5, spacing = 2.5;
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const x = (i - rows / 2) * (4 + spacing);
            const z = (j - cols / 2) * (2 + spacing);
            const panel = new THREE.Mesh(panelGeo, panelMat);
            panel.position.set(x, panelHeight + 0.1, z);
            panel.rotation.x = panelAngle;
            farmGroup.add(panel);
            const post1 = new THREE.Mesh(postGeo, postMat);
            post1.position.set(x - 0.8, panelHeight / 2, z);
            farmGroup.add(post1);
            const post2 = new THREE.Mesh(postGeo, postMat);
            post2.position.set(x + 0.8, panelHeight / 2, z);
            farmGroup.add(post2);
            for(let p = 0; p < 3; p++){
                const plant = new THREE.Mesh(plantGeo, plantMat);
                plant.position.set(x + (Math.random() - 0.5) * 2, 0.2, z + p - 1);
                farmGroup.add(plant);
            }
        }
    }
}
panelSelect.addEventListener('change', createFarm);
cropSelect.addEventListener('change', createFarm);
function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}
let myChart = null;
function renderChart(data) {
    const ctx = document.getElementById('yieldChart').getContext('2d');
    if (myChart) { myChart.destroy(); }
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
            datasets: [{
                label: 'Crop Growth Potential (%)',
                data: data,
                backgroundColor: 'rgba(34, 197, 94, 0.2)',
                borderColor: 'rgba(34, 197, 94, 1)',
                borderWidth: 2,
                tension: 0.4,
                pointBackgroundColor: 'rgba(34, 197, 94, 1)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: 'Monthly Growth Potential', color: '#9ca3af'} },
            scales: {
                y: { beginAtZero: true, max: 100, ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.1)' } },
                x: { ticks: { color: '#9ca3af' }, grid: { display: false } }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    init3D();
    triggerSimulation();

    // Modal Logic
    versionBtn.addEventListener('click', () => {
        versionModal.classList.remove('hidden');
    });
    closeModalBtn.addEventListener('click', () => {
        versionModal.classList.add('hidden');
    });
    versionModal.addEventListener('click', (e) => {
        if (e.target === versionModal) { // Close if clicking on the dark overlay
            versionModal.classList.add('hidden');
        }
    });
});