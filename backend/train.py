import os
import sys
import zipfile
import yaml
import torch

# Patch torch.load to default to weights_only=False to allow YOLOv8 custom classes loading
_orig_load = torch.load
def _patched_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return _orig_load(*args, **kwargs)
torch.load = _patched_load

from ultralytics import YOLO

def main():
    zip_path = r"../datasets/Motorcycle, Riders & Helmet Violations/archive (2).zip"
    extract_dir = r"../datasets/extracted_helmet_dataset"

    if not os.path.exists(zip_path):
        print(f"Error: Dataset archive not found at {zip_path}")
        sys.exit(1)

    print("Step 1: Extracting helmet dataset...")
    os.makedirs(extract_dir, exist_ok=True)
    with zipfile.ZipFile(zip_path, 'r') as zf:
        zf.extractall(extract_dir)

    print("Step 2: Configuring dataset paths...")
    yaml_path = os.path.join(extract_dir, "coco128.yaml")
    
    # Read yaml
    with open(yaml_path, 'r') as f:
        data = yaml.safe_load(f)

    # Set absolute paths for local training
    data['path'] = os.path.abspath(extract_dir)
    data['train'] = os.path.join(os.path.abspath(extract_dir), "train", "images")
    data['val'] = os.path.join(os.path.abspath(extract_dir), "train", "images")

    # Write back
    with open(yaml_path, 'w') as f:
        yaml.dump(data, f)

    print("Step 3: Initializing YOLOv8 model and starting training...")
    # Using small batch size and image size for fast CPU training
    model = YOLO('yolov8n.pt')
    
    # Train for 15 epochs
    model.train(
        data=yaml_path, 
        epochs=15, 
        batch=8, 
        imgsz=320, 
        workers=1, 
        device='cpu', 
        verbose=True
    )
    
    print("\nTraining completed successfully!")
    print("Trained custom weights saved in: backend/runs/detect/train/weights/best.pt")

if __name__ == "__main__":
    main()
