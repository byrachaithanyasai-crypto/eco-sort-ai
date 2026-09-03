from io import BytesIO
from pathlib import Path
from datetime import datetime, timezone
import sqlite3

import torch
import torch.nn.functional as F

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from PIL import Image

from predict import (
    model,
    transform,
    CLASS_NAMES,
    RECOMMENDATIONS,
)


# ============================================================
# ECO-SORT AI — COMPLETE BACKEND
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATABASE_DIR = BASE_DIR / "data"
DATABASE_PATH = DATABASE_DIR / "eco_sort.db"

DATABASE_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="ECO-SORT AI",
    description=(
        "AI-powered waste classification and "
        "smart disposal recommendation system."
    ),
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE
# ============================================================

def get_connection():

    connection = sqlite3.connect(
        DATABASE_PATH
    )

    connection.row_factory = sqlite3.Row

    return connection


def initialize_database():

    connection = get_connection()

    cursor = connection.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT,
            category TEXT NOT NULL,
            confidence REAL NOT NULL,
            status TEXT NOT NULL,
            recommended_bin TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
        """
    )

    connection.commit()
    connection.close()


initialize_database()


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "name": "ECO-SORT AI",
        "message": (
            "Smart Waste Classification API is running."
        ),
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "predict": "/predict",
        "history": "/history",
        "stats": "/stats",
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "ok",
        "service": "ECO-SORT AI Backend",
        "version": "1.0.0",
        "model": "MobileNetV3-Small",
        "classes": CLASS_NAMES,
        "database": "SQLite",
    }


# ============================================================
# PREDICT WASTE
# ============================================================

@app.post("/predict")
async def predict(
    file: UploadFile = File(...)
):

    # --------------------------------------------------------
    # Validate file type
    # --------------------------------------------------------

    if (
        not file.content_type
        or not file.content_type.startswith("image/")
    ):

        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image file.",
        )


    # --------------------------------------------------------
    # Read image
    # --------------------------------------------------------

    image_bytes = await file.read()

    if not image_bytes:

        raise HTTPException(
            status_code=400,
            detail="The uploaded image is empty.",
        )


    # --------------------------------------------------------
    # File size protection
    # --------------------------------------------------------

    max_file_size = 10 * 1024 * 1024

    if len(image_bytes) > max_file_size:

        raise HTTPException(
            status_code=400,
            detail=(
                "Image is too large. "
                "Maximum size is 10 MB."
            ),
        )


    # --------------------------------------------------------
    # Open and validate image
    # --------------------------------------------------------

    try:

        image = Image.open(
            BytesIO(image_bytes)
        ).convert("RGB")

    except Exception:

        raise HTTPException(
            status_code=400,
            detail=(
                "The uploaded file is not "
                "a valid image."
            ),
        )


    # --------------------------------------------------------
    # Preprocess
    # --------------------------------------------------------

    image_tensor = transform(
        image
    ).unsqueeze(0)


    # --------------------------------------------------------
    # AI inference
    # --------------------------------------------------------

    try:

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

    except Exception as error:

        raise HTTPException(
            status_code=500,
            detail=(
                f"Model prediction failed: {error}"
            ),
        )


    # --------------------------------------------------------
    # Prediction result
    # --------------------------------------------------------

    category = CLASS_NAMES[
        predicted_index.item()
    ]

    confidence_percentage = (
        confidence.item() * 100
    )

    recommendation = RECOMMENDATIONS[
        category
    ]


    # --------------------------------------------------------
    # Confidence handling
    # --------------------------------------------------------

    if confidence_percentage < 60:

        status = "low_confidence"

        message = (
            "The AI is not sufficiently confident. "
            "Please verify the item manually "
            "before disposal."
        )

    else:

        status = "confident"

        message = recommendation[
            "message"
        ]


    # --------------------------------------------------------
    # Timestamp
    # --------------------------------------------------------

    created_at = datetime.now(
        timezone.utc
    ).isoformat()


    # --------------------------------------------------------
    # Save scan
    # --------------------------------------------------------

    connection = get_connection()

    try:

        cursor = connection.cursor()

        cursor.execute(
            """
            INSERT INTO scans (
                filename,
                category,
                confidence,
                status,
                recommended_bin,
                message,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                file.filename,
                category,
                round(
                    confidence_percentage,
                    2,
                ),
                status,
                recommendation["bin"],
                message,
                created_at,
            ),
        )

        connection.commit()

        scan_id = cursor.lastrowid

    finally:

        connection.close()


    # --------------------------------------------------------
    # Response
    # --------------------------------------------------------

    return {
        "status": status,

        "scan_id": scan_id,

        "filename": file.filename,

        "category": category,

        "confidence": round(
            confidence_percentage,
            2,
        ),

        "recommended_bin":
            recommendation["bin"],

        "message": message,

        "model":
            "MobileNetV3-Small",

        "created_at":
            created_at,
    }


# ============================================================
# SCAN HISTORY
# ============================================================

@app.get("/history")
def history(
    limit: int = 20,
):

    limit = max(
        1,
        min(limit, 100),
    )


    connection = get_connection()

    try:

        cursor = connection.cursor()

        cursor.execute(
            """
            SELECT
                id,
                filename,
                category,
                confidence,
                status,
                recommended_bin,
                message,
                created_at
            FROM scans
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        )

        rows = cursor.fetchall()

    finally:

        connection.close()


    scans = [
        dict(row)
        for row in rows
    ]


    return {
        "count": len(scans),
        "scans": scans,
    }


# ============================================================
# DASHBOARD STATISTICS
# ============================================================

@app.get("/stats")
def stats():

    connection = get_connection()

    try:

        cursor = connection.cursor()


        # ----------------------------------------------------
        # Total scans
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM scans
            """
        )

        total_scans = (
            cursor.fetchone()["total"]
        )


        # ----------------------------------------------------
        # Category counts
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                category,
                COUNT(*) AS count
            FROM scans
            GROUP BY category
            """
        )

        category_rows = cursor.fetchall()


        category_counts = {
            category: 0
            for category in CLASS_NAMES
        }


        for row in category_rows:

            category_counts[
                row["category"]
            ] = row["count"]


        # ----------------------------------------------------
        # Average confidence
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT
                AVG(confidence) AS average_confidence
            FROM scans
            """
        )

        average_row = cursor.fetchone()

        average_confidence = (
            average_row["average_confidence"]
        )


        # ----------------------------------------------------
        # Low-confidence scans
        # ----------------------------------------------------

        cursor.execute(
            """
            SELECT COUNT(*) AS count
            FROM scans
            WHERE status = 'low_confidence'
            """
        )

        low_confidence = (
            cursor.fetchone()["count"]
        )

    finally:

        connection.close()


    if average_confidence is None:

        average_confidence = 0.0


    return {
        "total_scans":
            total_scans,

        "recyclable":
            category_counts["Recyclable"],

        "organic":
            category_counts["Organic"],

        "hazardous":
            category_counts["Hazardous"],

        "average_confidence":
            round(
                average_confidence,
                2,
            ),

        "low_confidence_scans":
            low_confidence,
    }

# ============================================================
# CLEAR SCAN HISTORY
# ============================================================

@app.delete("/history")
def delete_history():

    connection = get_connection()

    try:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM scans")
        deleted_count = cursor.rowcount
        connection.commit()
    finally:
        connection.close()

    return {
        "message": "History cleared successfully",
        "deleted_count": deleted_count,
    }
