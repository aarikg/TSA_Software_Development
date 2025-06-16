from ultralytics import YOLO
import torch

def main():
    """
    Main function to run the YOLOv8 model training.
    This version is optimized for faster training cycles.
    """
    # --- Step 1: Check for GPU/MPS availability ---
    # This checks if your M1/M2/M3 Mac's GPU (MPS) is available for PyTorch to use.
    if torch.backends.mps.is_available():
        device = "mps"
        print("Metal Performance Shader (MPS) is available. Using GPU for faster training.")
    else:
        device = "cpu"
        print("MPS not available. Using CPU. Training will be slower.")

    # --- Step 2: Load a Pre-trained Model ---
    # We start with a model that already knows how to detect objects.
    # 'yolov8n.pt' is the smallest and fastest version.
    model = YOLO('yolov8n.pt')
    print("Loaded pre-trained yolov8n.pt model.")

    # --- Step 3: Train the Model with Optimized Settings ---
    # This is the core training command.
    print("Starting model training with optimized settings...")
    results = model.train(
        data='Weed-Detection-5/data.yaml',  # Path to your dataset's .yaml file
        
        # --- SPEED OPTIMIZATIONS ---
        epochs=25,                          # REDUCED: 25 is often enough for a good result.
        imgsz=640,                          # Standard image size. You could lower to 416 for more speed.
        batch=16,                           # Number of images to process at once.
        cache=True,                         # NEW: Caches the dataset in RAM for faster loading after 1st epoch.
        # ---------------------------

        device=device,                      # Use the detected device (GPU or CPU)
        name='yolo_weed_detection_run_fast' # A new name for this faster run
    )
    print("Training complete.")
    print("Your trained model can be found in the 'runs/detect/yolo_weed_detection_run_fast/weights/' directory.")
    print("Look for the file named 'best.pt' and move it to your main project folder.")

if __name__ == '__main__':
    main()
