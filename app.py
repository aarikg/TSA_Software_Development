from flask import Flask, render_template, request, jsonify
from datetime import datetime
import os
from utils.weather import get_weather_data
from utils.calculations import calculate_irrigation

app = Flask(__name__)
app.config.from_pyfile('config.py')


CROP_DATA = {
    'tomato': {'water_needs': 25, 'root_depth': 45},
    'corn': {'water_needs': 30, 'root_depth': 60},
    'wheat': {'water_needs': 20, 'root_depth': 50},
    'lettuce': {'water_needs': 15, 'root_depth': 30}
}

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/dashboard', methods=['GET', 'POST'])
def dashboard():
    if request.method == 'POST':
        location = request.form.get('location')
        crop_type = request.form.get('crop_type')
        soil_type = request.form.get('soil_type')
        area = float(request.form.get('area', 1))
        
        weather = get_weather_data(location)
        

        if weather.get('error'):
            return render_template('dashboard.html', 
                               error=weather['error'],
                               crops=CROP_DATA.keys())
        
        recommendations = calculate_irrigation(
            weather['precipitation'],
            weather['temperature'],
            CROP_DATA[crop_type]['water_needs'],
            CROP_DATA[crop_type]['root_depth'],
            soil_type,
            area
        )
        
        return render_template('dashboard.html', 
                            location=weather['location'], 
                            crop_type=crop_type,
                            soil_type=soil_type,
                            area=area,
                            weather=weather,
                            recommendations=recommendations,
                            crops=CROP_DATA.keys())
    
    return render_template('dashboard.html', crops=CROP_DATA.keys())

@app.route('/calculator')
def calculator():
    return render_template('calculator.html')

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/get_weather', methods=['POST'])
def get_weather():
    location = request.json.get('location')
    weather = get_weather_data(location)
    return jsonify(weather)

if __name__ == '__main__':
    app.run(debug=True)