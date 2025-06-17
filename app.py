from flask import Flask, render_template, jsonify, request
import time
import requests

app = Flask(__name__)

# --- API Communication Functions ---
def get_location_coordinates(location_name):
    """Fetches latitude and longitude for a location name using Open-Meteo's geocoding API."""
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": location_name, "count": 1, "language": "en", "format": "json"}
    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        results = response.json().get("results")
        if results:
            return results[0]["latitude"], results[0]["longitude"], results[0].get("name", location_name)
    except requests.RequestException as e:
        print(f"Error fetching coordinates: {e}")
    return None, None, None

def get_solar_data(latitude, longitude):
    """Fetches average daily solar radiation for the past year for a given lat/lon."""
    url = "https://archive-api.open-meteo.com/v1/archive"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "daily": "shortwave_radiation_sum",
        "timezone": "auto",
        "start_date": "2023-01-01",
        "end_date": "2023-12-31"
    }
    try:
        response = requests.get(url, params=params, timeout=5)
        response.raise_for_status()
        daily_data = response.json().get("daily", {}).get("shortwave_radiation_sum", [])
        valid_data = [v for v in daily_data if v is not None]
        if valid_data:
            avg_mj = sum(valid_data) / len(valid_data)
            avg_kwh = avg_mj * 0.277778
            return round(avg_kwh, 2)
    except requests.RequestException as e:
        print(f"Error fetching solar data: {e}")
    return None


# --- Main Simulation Engine ---
def run_simulation(location, crop_type, panel_config, soil_composition):
    latitude, longitude, found_name = get_location_coordinates(location)
    if latitude is None or longitude is None:
        return {"error": "Could not find location"}

    base_solar_irradiance = get_solar_data(latitude, longitude)
    if base_solar_irradiance is None:
        return {"error": "Could not fetch weather data"}

    sand = soil_composition.get("sand", 33) / 100
    silt = soil_composition.get("silt", 33) / 100
    clay = soil_composition.get("clay", 34) / 100
    soil_water_retention_factor = 1.0 + (0.3 * clay) + (0.1 * silt) - (0.15 * sand)

    crop_modifiers = {
        'Lettuce': {'shade_tolerance': 0.95}, 'Wheat': {'shade_tolerance': 0.88},
        'Corn': {'shade_tolerance': 0.75}, 'Tomatoes':{'shade_tolerance': 0.90}
    }
    panel_modifiers = {
        'Standard': {'energy_efficiency': 1.0, 'shading_factor': 0.20, 'cost_multiplier': 1.0},
        'Vertical': {'energy_efficiency': 0.9, 'shading_factor': 0.15, 'cost_multiplier': 1.4},
        'High-Clearance': {'energy_efficiency': 1.1, 'shading_factor': 0.25, 'cost_multiplier': 1.2}
    }

    crop_mod = crop_modifiers.get(crop_type, list(crop_modifiers.values())[0])
    panel_mod = panel_modifiers.get(panel_config, list(panel_modifiers.values())[0])

    yield_reduction_from_shade = 1 - panel_mod['shading_factor']
    predicted_yield = 100 * yield_reduction_from_shade * crop_mod['shade_tolerance']

    energy_generated_mwh = (base_solar_irradiance * 365 * 200 * panel_mod['energy_efficiency']) / 1000
    
    water_saved = 100 - (100 * (1 - panel_mod['shading_factor']) / soil_water_retention_factor)

    panel_cost = 15000 * panel_mod['cost_multiplier']
    energy_revenue = energy_generated_mwh * 150
    crop_revenue = 4000 * (predicted_yield / 100)
    annual_revenue = energy_revenue + crop_revenue
    payback_period = panel_cost / annual_revenue if annual_revenue > 0 else float('inf')

    growth_data = []
    peak_month = 6
    for i in range(12):
        distance_from_peak = abs(i - peak_month)
        monthly_potential = 95 * (1 - (distance_from_peak / 6)**2) * (base_solar_irradiance / 5.5) # Normalize growth by solar intensity
        final_growth = monthly_potential * (predicted_yield / 100)
        growth_data.append(max(5, round(final_growth)))

    return {
        "locationData": { "name": found_name, "irradiance": base_solar_irradiance },
        "energyGeneratedMWh": round(energy_generated_mwh, 2),
        "predictedYieldPercent": round(predicted_yield, 1),
        "waterSavedPercent": round(water_saved, 1),
        "yieldChartData": growth_data,
        "economics": {
            "panelCost": f"${panel_cost:,.0f}",
            "annualRevenue": f"${annual_revenue:,.0f}",
            "paybackPeriod": round(payback_period, 1)
        }
    }

# --- Flask Routes ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/run_simulation', methods=['POST'])
def simulation_route():
    data = request.json
    location = data.get('location')
    crop_type = data.get('crop')
    panel_config = data.get('panel')
    soil_composition = data.get('soil')
    
    time.sleep(0.5)

    results = run_simulation(location, crop_type, panel_config, soil_composition)

    return jsonify(results)

if __name__ == '__main__':
    app.run(debug=True)