def calculate_irrigation(precipitation, temperature, crop_water_needs, root_depth, soil_type, area):
    """Calculate irrigation needs using FAO Penman-Monteith inspired formulas"""
    

    soil_properties = {
        'sand': {'water_holding': 0.1, 'efficiency_factor': 0.6},    
        'loam': {'water_holding': 0.18, 'efficiency_factor': 0.75},  
        'clay': {'water_holding': 0.25, 'efficiency_factor': 0.9}   
    }
    

    soil = soil_properties.get(soil_type.lower(), soil_properties['loam'])
    

    eto = crop_water_needs * (1 + (temperature - 20) * 0.02)
    

    effective_rain = min(precipitation, 0.8 * precipitation + 5) if precipitation > 5 else precipitation
    

    available_water = root_depth * soil['water_holding'] * 1000  
    

    net_irrigation = max(0, eto - effective_rain)
    

    volume_needed = net_irrigation * area
        

    efficiency = soil['efficiency_factor'] * 100 if net_irrigation > 0 else 100
    
    # use the fao threshold
    irrigation_today = "Today" if net_irrigation > (0.5 * available_water) else "Not needed today"
    

    standard_practice = crop_water_needs * 1.3 * area
    water_saved = standard_practice - volume_needed
    
    return {
        'irrigation_mm': round(net_irrigation, 1),
        'volume_liters': round(volume_needed, 1),
        'water_saved': round(water_saved, 1),
        'next_irrigation': irrigation_today,
        'efficiency': f"{round(efficiency)}%",
        'soil_moisture': f"{round((1 - (net_irrigation/available_water)) * 100)}%" if available_water > 0 else "100%"
    }