import os
import json
from flask import Flask, render_template, request, jsonify
from PIL import Image
import torch
from ultralytics import YOLO
import math

# Initialize the Flask application
app = Flask(__name__)

# --- CONFIGURATION ---
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- MODEL LOADING ---
# Ensure you have your trained 'best.pt' file in this directory.
# If not, it will use the generic 'yolov8n.pt' as a fallback.
MODEL_PATH = 'best.pt'
if not os.path.exists(MODEL_PATH):
    print(f"Warning: '{MODEL_PATH}' not found. Falling back to 'yolov8n.pt'.")
    print("For best results, train your custom model and place 'best.pt' here.")
    MODEL_PATH = 'yolov8n.pt'

try:
    model = YOLO(MODEL_PATH)
    print(f"Successfully loaded model: {MODEL_PATH}")
except Exception as e:
    print(f"Error loading model: {e}")
    # Exit if the model can't be loaded, as the app is not useful without it.
    exit()

# Ensure the upload folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    """Checks if the uploaded file has an allowed extension."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def run_ai_model_on_tile(tile_image):
    """
    Runs the YOLOv8 model on a single image tile.
    
    Args:
        tile_image (PIL.Image): An image tile to process.

    Returns:
        tuple: A list of detection dictionaries for the tile and the tile's dimensions.
    """
    try:
        # Perform inference on the image tile
        results = model(tile_image)
        result = results[0]
        tile_width, tile_height = result.orig_shape[1], result.orig_shape[0]

        detections = []
        for box in result.boxes:
            class_id = int(box.cls[0].item())
            class_name = result.names[class_id]
            confidence = box.conf[0].item()
            
            # We only want to detect 'weed' class. 
            # If your custom model has other classes, you can filter them here.
            # For the base YOLO model, 'potted plant' is a decent proxy for testing.
            if 'weed' in class_name.lower() or 'plant' in class_name.lower():
                coords_pixel = box.xyxy[0].tolist()
                center_x_pixel = (coords_pixel[0] + coords_pixel[2]) / 2
                center_y_pixel = (coords_pixel[1] + coords_pixel[3]) / 2
                
                detections.append({
                    'type': class_name,
                    'confidence': confidence,
                    'coords_pixel': {
                        'x': center_x_pixel,
                        'y': center_y_pixel
                    }
                })
        return detections, (tile_width, tile_height)
        
    except Exception as e:
        print(f"An error occurred during tile inference: {e}")
        return [], (0, 0)

def process_image_with_tiling(image_path, tile_size=640, overlap=0.2):
    """
    Slices the large image into smaller tiles, runs AI on each, and aggregates results.

    Args:
        image_path (str): The path to the large field image.
        tile_size (int): The width and height of the square tiles (should match model input size).
        overlap (float): The percentage of overlap between tiles to avoid missing detections on edges.

    Returns:
        list: A consolidated list of unique detections with coordinates normalized to the original image.
    """
    try:
        large_image = Image.open(image_path).convert("RGB")
        img_width, img_height = large_image.size
        
        all_detections = []
        step_size = int(tile_size * (1 - overlap))
        
        # Loop over the large image, creating tiles
        for y in range(0, img_height, step_size):
            for x in range(0, img_width, step_size):
                # Define the box for the tile
                box = (x, y, x + tile_size, y + tile_size)
                # Crop the tile from the large image
                tile = large_image.crop(box)
                
                # Run the AI model on the individual tile
                tile_detections, _ = run_ai_model_on_tile(tile)
                
                # Convert tile-local coordinates to original image coordinates
                for det in tile_detections:
                    original_x = x + det['coords_pixel']['x']
                    original_y = y + det['coords_pixel']['y']
                    
                    # Normalize coordinates based on the full image size for the frontend
                    normalized_x = original_x / img_width
                    normalized_y = original_y / img_height
                    
                    all_detections.append({
                        'type': det['type'],
                        'confidence': round(det['confidence'], 2),
                        'coords': {'x': round(normalized_x, 4), 'y': round(normalized_y, 4)}
                    })

        # This is a simple way to remove duplicate detections from overlapping areas
        # A more advanced method would use Non-Maximum Suppression (NMS)
        unique_detections = []
        for det in all_detections:
            is_duplicate = False
            for u_det in unique_detections:
                # If two detections are very close, consider them duplicates
                dist_sq = (det['coords']['x'] - u_det['coords']['x'])**2 + (det['coords']['y'] - u_det['coords']['y'])**2
                if dist_sq < 0.0001: # Small threshold for proximity
                    is_duplicate = True
                    break
            if not is_duplicate:
                unique_detections.append(det)

        return unique_detections
    except Exception as e:
        print(f"An error occurred during tiling process: {e}")
        return []

@app.route('/')
def index():
    """Renders the main dashboard page."""
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze_image():
    """Handles the image analysis request, now with tiling."""
    if 'fieldImage' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    file = request.files['fieldImage']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file and allowed_file(file.filename):
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], file.filename)
        file.save(filepath)

        # --- RUN LIVE AI MODEL WITH TILING ---
        try:
            # The core logic is now in the tiling function
            detections = process_image_with_tiling(filepath)
        
            return jsonify({
                'success': True,
                'image_url': f'/{filepath}',
                'detections': detections
            })
        except Exception as e:
            return jsonify({'error': f'An error occurred: {str(e)}'}), 500

    return jsonify({'error': 'File type not allowed'}), 400

if __name__ == '__main__':
    app.run(debug=True)

