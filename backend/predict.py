from pathlib import Path

import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import models, transforms


# ============================================================
# ECO-SORT AI — MODEL INFERENCE
# ============================================================

# Always resolve the model relative to this file.
# predict.py is inside:
# backend/
#
# Model is inside:
# backend/models/

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = (
    BASE_DIR
    / "models"
    / "eco_sort_model.pth"
)


# ============================================================
# CLASS NAMES
# ============================================================

CLASS_NAMES = [
    "Hazardous",
    "Organic",
    "Recyclable",
]


IMAGE_SIZE = 224


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

transform = transforms.Compose([
    transforms.Resize(
        (IMAGE_SIZE, IMAGE_SIZE)
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[
            0.485,
            0.456,
            0.406,
        ],
        std=[
            0.229,
            0.224,
            0.225,
        ],
    ),
])


# ============================================================
# LOAD MODEL
# ============================================================

def load_model():

    if not MODEL_PATH.exists():

        raise FileNotFoundError(
            f"Trained model not found at:\n"
            f"{MODEL_PATH}\n\n"
            f"Please make sure the model was trained "
            f"and saved to backend/models/."
        )


    checkpoint = torch.load(
        MODEL_PATH,
        map_location="cpu",
        weights_only=False,
    )


    model = models.mobilenet_v3_small(
        weights=None
    )


    in_features = (
        model.classifier[-1].in_features
    )


    model.classifier[-1] = torch.nn.Linear(
        in_features,
        len(CLASS_NAMES),
    )


    model.load_state_dict(
        checkpoint["model_state_dict"]
    )


    model.eval()

    return model


# Load model once when the backend starts.
model = load_model()


# ============================================================
# DISPOSAL RECOMMENDATIONS
# ============================================================

RECOMMENDATIONS = {

    "Hazardous": {
        "bin": "Hazardous Waste Bin",

        "message": (
            "Handle carefully and dispose of through "
            "an authorized hazardous-waste collection point."
        ),
    },


    "Organic": {
        "bin": "Organic / Compost Bin",

        "message": (
            "Place this waste in the organic or compost "
            "collection stream."
        ),
    },


    "Recyclable": {
        "bin": "Recycling Bin",

        "message": (
            "Place this item in the recycling stream "
            "if accepted by your local recycling program."
        ),
    },
}


# ============================================================
# PREDICTION FUNCTION
# ============================================================

def predict_waste(image_path):

    image_path = Path(image_path)


    if not image_path.exists():

        raise FileNotFoundError(
            f"Image not found: {image_path}"
        )


    # Open and convert image to RGB.
    image = Image.open(
        image_path
    ).convert("RGB")


    # Preprocess.
    image_tensor = transform(
        image
    ).unsqueeze(0)


    # AI inference.
    with torch.no_grad():

        outputs = model(
            image_tensor
        )


        probabilities = F.softmax(
            outputs,
            dim=1,
        )


        confidence, predicted_index = torch.max(
            probabilities,
            dim=1,
        )


    # Convert model index to class name.
    category = CLASS_NAMES[
        predicted_index.item()
    ]


    confidence_percentage = (
        confidence.item() * 100
    )


    # Get disposal recommendation.
    recommendation = RECOMMENDATIONS[
        category
    ]


    # Low-confidence handling.
    if confidence_percentage < 60:

        status = "low_confidence"

        message = (
            "The AI is not sufficiently confident. "
            "Please verify the item manually before disposal."
        )

    else:

        status = "confident"

        message = recommendation[
            "message"
        ]


    return {

        "status": status,

        "category": category,

        "confidence": round(
            confidence_percentage,
            2,
        ),

        "recommended_bin":
            recommendation["bin"],

        "message": message,

    }


# ============================================================
# COMMAND-LINE TEST
# ============================================================

if __name__ == "__main__":

    print("=" * 60)
    print("ECO-SORT AI — MODEL TEST")
    print("=" * 60)

    print(
        f"\nModel: {MODEL_PATH}"
    )

    print(
        f"Classes: {CLASS_NAMES}"
    )


    image_path = input(
        "\nEnter image path: "
    ).strip().strip('"')


    try:

        result = predict_waste(
            image_path
        )


        print("\nPrediction")
        print("-" * 40)


        print(
            f"Category          : "
            f"{result['category']}"
        )


        print(
            f"Confidence        : "
            f"{result['confidence']}%"
        )


        print(
            f"Recommended Bin   : "
            f"{result['recommended_bin']}"
        )


        print(
            f"Status            : "
            f"{result['status']}"
        )


        print(
            f"Guidance          : "
            f"{result['message']}"
        )


    except Exception as error:

        print(
            f"\nERROR: {error}"
        )


    print("=" * 60)