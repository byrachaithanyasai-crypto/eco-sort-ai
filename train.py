from pathlib import Path
import copy

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split, Subset
from torchvision import datasets, models, transforms


# ============================================================
# ECO-SORT AI — Waste Classification Training
# ============================================================

# -----------------------------
# Paths
# -----------------------------
DATASET_DIR = Path("dataset")
MODEL_PATH = Path("backend/models/eco_sort_model.pth")


# -----------------------------
# Official ECO-SORT AI classes
# -----------------------------
CLASS_NAMES = [
    "Hazardous",
    "Organic",
    "Recyclable",
]


# -----------------------------
# Training configuration
# -----------------------------
IMAGE_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 5
LEARNING_RATE = 0.0001
VALIDATION_SPLIT = 0.20
SEED = 42


# -----------------------------
# Reproducibility
# -----------------------------
torch.manual_seed(SEED)


# -----------------------------
# Device
# -----------------------------
device = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)

print("=" * 60)
print("ECO-SORT AI — MODEL TRAINING")
print("=" * 60)
print(f"Device: {device}")


# ============================================================
# IMAGE TRANSFORMS
# ============================================================

train_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

    transforms.RandomHorizontalFlip(
        p=0.5
    ),

    transforms.RandomRotation(
        degrees=10
    ),

    transforms.ColorJitter(
        brightness=0.2,
        contrast=0.2,
        saturation=0.2,
    ),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


val_transform = transforms.Compose([
    transforms.Resize((IMAGE_SIZE, IMAGE_SIZE)),

    transforms.ToTensor(),

    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225],
    ),
])


# ============================================================
# LOAD DATASET
# ============================================================

print("\nLoading dataset...")

# We create one ImageFolder per official class.
# This completely excludes Non-Recyclable.

class_datasets = []

for class_name in CLASS_NAMES:

    class_path = DATASET_DIR / class_name

    # Your Kaggle dataset has an additional nested folder:
    #
    # dataset/
    #   Hazardous/
    #       Hazardous/
    #           batteries/
    #           e-waste/
    #
    # So we search recursively for image files.

    image_files = []

    for extension in [
        "*.jpg",
        "*.jpeg",
        "*.png",
        "*.JPG",
        "*.JPEG",
        "*.PNG",
    ]:
        image_files.extend(
            class_path.rglob(extension)
        )

    image_files = sorted(image_files)

    if not image_files:
        raise RuntimeError(
            f"No images found for class: {class_name}\n"
            f"Expected folder: {class_path}"
        )

    print(
        f"{class_name:12} : {len(image_files)} images"
    )

    class_datasets.append(
        image_files
    )


# ============================================================
# BALANCE CLASSES
# ============================================================

# Recyclable has the fewest images.
# We use the same number from every class to keep training balanced.

images_per_class = min(
    len(images)
    for images in class_datasets
)

print(
    f"\nBalanced images per class: {images_per_class}"
)

print(
    f"Total images used: "
    f"{images_per_class * len(CLASS_NAMES)}"
)


# ============================================================
# CUSTOM DATASET
# ============================================================

from PIL import Image


class WasteDataset(torch.utils.data.Dataset):

    def __init__(
        self,
        samples,
        transform=None,
    ):

        self.samples = samples
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):

        image_path, label = self.samples[index]

        try:

            image = Image.open(
                image_path
            ).convert("RGB")

        except Exception as error:

            raise RuntimeError(
                f"Could not open image: "
                f"{image_path}"
            ) from error

        if self.transform:
            image = self.transform(image)

        return image, label


# ============================================================
# BUILD BALANCED SAMPLE LIST
# ============================================================

all_samples = []

for label, image_files in enumerate(class_datasets):

    # Deterministic selection.
    selected_images = image_files[
        :images_per_class
    ]

    for image_path in selected_images:

        all_samples.append(
            (
                image_path,
                label,
            )
        )


# Shuffle samples before splitting.
generator = torch.Generator().manual_seed(SEED)

random_indices = torch.randperm(
    len(all_samples),
    generator=generator,
).tolist()

all_samples = [
    all_samples[index]
    for index in random_indices
]


# ============================================================
# TRAIN / VALIDATION SPLIT
# ============================================================

val_size = int(
    len(all_samples) * VALIDATION_SPLIT
)

train_size = (
    len(all_samples) - val_size
)

train_samples = all_samples[
    :train_size
]

val_samples = all_samples[
    train_size:
]


train_dataset = WasteDataset(
    train_samples,
    transform=train_transform,
)

val_dataset = WasteDataset(
    val_samples,
    transform=val_transform,
)


train_loader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    num_workers=0,
)

val_loader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    num_workers=0,
)


print(
    f"\nTraining images   : {len(train_dataset)}"
)

print(
    f"Validation images : {len(val_dataset)}"
)


# ============================================================
# CREATE MOBILE NET V3 MODEL
# ============================================================

print("\nLoading pretrained MobileNetV3...")

weights = models.MobileNet_V3_Small_Weights.DEFAULT

model = models.mobilenet_v3_small(
    weights=weights
)


# Freeze pretrained feature extractor.
for parameter in model.features.parameters():

    parameter.requires_grad = False


# Replace final classifier.
in_features = (
    model.classifier[-1].in_features
)

model.classifier[-1] = nn.Linear(
    in_features,
    len(CLASS_NAMES),
)


model = model.to(device)


# ============================================================
# LOSS + OPTIMIZER
# ============================================================

criterion = nn.CrossEntropyLoss()

optimizer = torch.optim.Adam(
    model.classifier[-1].parameters(),
    lr=LEARNING_RATE,
)


# ============================================================
# TRAINING
# ============================================================

best_accuracy = 0.0

best_model_state = None

MODEL_PATH.parent.mkdir(
    parents=True,
    exist_ok=True,
)


print("\nStarting training...")
print("=" * 60)


for epoch in range(EPOCHS):

    # --------------------------------------------------------
    # TRAIN
    # --------------------------------------------------------

    model.train()

    running_loss = 0.0

    train_correct = 0
    train_total = 0


    for images, labels in train_loader:

        images = images.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()

        outputs = model(images)

        loss = criterion(
            outputs,
            labels
        )

        loss.backward()

        optimizer.step()


        running_loss += loss.item()

        _, predictions = torch.max(
            outputs,
            1
        )

        train_total += labels.size(0)

        train_correct += (
            predictions == labels
        ).sum().item()


    train_accuracy = (
        100.0
        * train_correct
        / train_total
    )


    # --------------------------------------------------------
    # VALIDATION
    # --------------------------------------------------------

    model.eval()

    val_correct = 0
    val_total = 0


    with torch.no_grad():

        for images, labels in val_loader:

            images = images.to(device)
            labels = labels.to(device)

            outputs = model(images)

            _, predictions = torch.max(
                outputs,
                1
            )

            val_total += labels.size(0)

            val_correct += (
                predictions == labels
            ).sum().item()


    val_accuracy = (
        100.0
        * val_correct
        / val_total
    )


    average_loss = (
        running_loss
        / len(train_loader)
    )


    print(
        f"Epoch {epoch + 1}/{EPOCHS} | "
        f"Loss: {average_loss:.4f} | "
        f"Train Acc: {train_accuracy:.2f}% | "
        f"Val Acc: {val_accuracy:.2f}%"
    )


    # --------------------------------------------------------
    # SAVE BEST MODEL
    # --------------------------------------------------------

    if val_accuracy > best_accuracy:

        best_accuracy = val_accuracy

        best_model_state = copy.deepcopy(
            model.state_dict()
        )

        torch.save(
            {
                "model_state_dict":
                    best_model_state,

                "class_names":
                    CLASS_NAMES,

                "image_size":
                    IMAGE_SIZE,

                "validation_accuracy":
                    val_accuracy,
            },
            MODEL_PATH,
        )

        print(
            f"  ✓ Best model saved: "
            f"{MODEL_PATH}"
        )


# ============================================================
# FINISHED
# ============================================================

print("\n" + "=" * 60)
print("TRAINING COMPLETE")
print("=" * 60)

print(
    f"Best validation accuracy: "
    f"{best_accuracy:.2f}%"
)

print(
    f"Model file: {MODEL_PATH}"
)

print(
    "\nClasses:"
)

for index, class_name in enumerate(
    CLASS_NAMES
):

    print(
        f"  {index} → {class_name}"
    )

print("=" * 60)