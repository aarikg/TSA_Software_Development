import requests
from datetime import datetime
from config import WEATHER_API_URL, WEATHER_API_KEY

def get_weather_data(location):
    """Fetch weather data from WeatherAPI with proper location handling"""
    params = {
        'key': WEATHER_API_KEY,
        'q': location,
        'aqi': 'no'
    }
    
    try:
        response = requests.get(WEATHER_API_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
# handle error
        if 'error' in data and data['error']['code'] == 1006:
            return {
                'error': f"Location not found: {location}",
                'location': None
            }
            

        full_location = f"{data['location']['name']}, {data['location']['region']}" if data['location']['region'] else data['location']['name']
        
        return {
            'location': full_location,
            'temperature': data['current']['temp_c'],
            'humidity': data['current']['humidity'],
            'precipitation': data['current']['precip_mm'],
            'wind_speed': data['current']['wind_kph'],
            'conditions': data['current']['condition']['text'],
            'icon': data['current']['condition']['icon'].split('/')[-1],
            'timestamp': datetime.now(),
            'error': None
        }
        
    except Exception as e:
        return {
            'error': f"Weather service unavailable: {str(e)}",
            'location': None
        }