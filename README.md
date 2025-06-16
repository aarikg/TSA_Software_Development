### Smart Irrigation Advisor

The Smart Irrigation Advisor is a web application designed to help farmers and gardeners optimize their water usage for sustainable agriculture. By leveraging real-time weather data and crop-specific information, the application provides intelligent irrigation recommendations to conserve water, reduce costs, and improve crop yields. This project was developed for the 2025 TSA Software Development competition.

### Features

  * **Personalized Irrigation Recommendations:** Get irrigation advice tailored to your specific location, crop type, soil, and area size.
  * **Real-time Weather Integration:** The system uses live weather data to provide accurate and timely recommendations.
  * **Water Savings Calculator:** Estimate your potential water savings by comparing your current usage to the smart irrigation system's recommendations.
  * **Crop-Specific Data:** The application includes a database of common crops with their unique water needs and root depths.
  * **User-Friendly Dashboard:** A clean and intuitive interface for entering data and viewing recommendations.

### Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

#### Prerequisites

  * Python 3.x
  * pip (Python package installer)

#### Installation

1.  **Clone the repository:**

    ```
    git clone https://github.com/aarikg/tsa_software_development.git
    cd tsa_software_development
    ```

2.  **Install the required packages:**

    ```
    pip install -r requirements.txt
    ```

    The required packages are Flask, requests, python-dotenv, and gunicorn.

3.  **Set up the environment variables:**

    Create a `.env` file in the root directory and add your WeatherAPI.com API key:

    ```
    WEATHER_API_KEY="YOUR_API_KEY"
    ```

4.  **Run the application:**

    ```
    python app.py
    ```

    The application will be running at `http://127.0.0.1:5000`.

### Usage

1.  Navigate to the **Dashboard** page.
2.  Enter your location, crop type, soil type, and the area of your field.
3.  Click "Get Recommendations" to see the personalized irrigation advice.
4.  Use the **Calculator** to estimate your potential water savings.
5.  Visit the **About** page to learn more about the project's mission and the environmental impact of smart irrigation.

### Project Structure

  * `app.py`: The main Flask application file that handles routing and back-end logic.
  * `config.py`: Configuration file for the Flask application, including the API key and other settings.
  * `requirements.txt`: A list of the Python packages required to run the project.
  * `static/`: Contains the static files for the website, including CSS and JavaScript.
  * `templates/`: Contains the HTML templates for the website's pages.
  * `utils/`: Contains helper scripts for calculations and fetching weather data.
      * `calculations.py`: A script with functions to calculate irrigation needs.
      * `weather.py`: A script to fetch weather data from the WeatherAPI.
