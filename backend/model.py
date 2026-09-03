import torch
import torch.nn as nn
from torchvision import models


CLASS_NAMES = [
    "recyclable",
    "organic",
    "hazardous",
]


def create_model():
    model = models.mobilenet_v3_small(
        weights=models.MobileNet_V3_Small_Weights.DEFAULT
    )

    # Replace the final classifier for our 3 waste categories.
    in_features = model.classifier[-1].in_features

    model.classifier[-1] = nn.Linear(
        in_features,
        len(CLASS_NAMES),
    )

    return model