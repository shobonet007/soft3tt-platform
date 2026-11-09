import asyncio
import io
import os
import re
import secrets
import threading
import zipfile
from contextlib import asynccontextmanager
from typing import Optional

import numpy as np
import torch
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response, StreamingResponse
from PIL import Image, ImageChops, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool
from transformers import AutoModelForImageSegmentation

MODEL_ID = os.getenv("MODEL_ID", "ZhengPeng7/BiRefNet")
REQUIRE_CUDA = os.getenv("REQUIRE_CUDA", "1").lower() not in {"0", "false", "no"}
WORKER_TOKEN = os.getenv("WORKER_TOKEN", "")
IMAGE_SIZE = int(os.getenv("IMAGE_SIZE", "1024"))
MAX_FILE_BYTES = 15 * 1024 * 1024
MAX_PIXELS = 40_000_000
MAX_FILES = 3
MAX_BATCH_BYTES = 48 * 1024 * 1024
Image.MAX_IMAGE_PIXELS = MAX_PIXELS

MODEL = None
DEVICE = "cpu"
MODEL_ERROR: Optional[str] = None
INFERENCE_LOCK = threading.Lock()


def load_model() -> None:
    global MODEL, DEVICE, MODEL_ERROR
    try:
        if REQUIRE_CUDA and not torch.cuda.is_available():
            raise RuntimeError("CUDA GPU is required. Attach a supported NVIDIA GPU or set REQUIRE_CUDA=0 for CPU testing.")
        DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
        MODEL = AutoModelForImageSegmentation.from_pretrained(MODEL_ID, trust_remote_code=True)
        MODEL.to(DEVICE)
        MODEL.eval()
        if DEVICE == "cuda":
            MODEL.half()
        MODEL_ERROR = None
    except Exception as exc:  # Keep health endpoint available so deployment errors are visible.
        MODEL = None
        MODEL_ERROR = str(exc)[:500]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await run_in_threadpool(load_model)
    yield


app = FastAPI(title="Soft3TT BiRefNet GPU worker", version="1.0.0", lifespan=lifespan)


def authorize(value: Optional[str]) -> None:
    if not WORKER_TOKEN or not value or not secrets.compare_digest(value, f"Bearer {WORKER_TOKEN}"):
        raise HTTPException(status_code=401, detail="Unauthorized")


def safe_stem(name: str) -> str:
    stem = os.path.splitext(os.path.basename(name or "image"))[0]
    stem = re.sub(r"[^a-zA-Z0-9_-]", "_", stem)[:70]
    return stem or "image"


def read_image(raw: bytes, label: str) -> Image.Image:
    if not raw or len(raw) > MAX_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"{label} must be between 1 byte and 15 MB.")
    try:
        opened = Image.open(io.BytesIO(raw))
        source_format = opened.format
        if source_format not in {"JPEG", "PNG", "WEBP"}:
            raise HTTPException(status_code=415, detail=f"{label} must be JPG, PNG or WEBP.")
        if opened.width * opened.height > MAX_PIXELS:
            raise HTTPException(status_code=413, detail=f"{label} exceeds the {MAX_PIXELS // 1_000_000} megapixel limit.")
        image = ImageOps.exif_transpose(opened)
        image.load()
        return image
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise HTTPException(status_code=415, detail=f"{label} is not a valid supported image.")


def extract_prediction(output):
    if hasattr(output, "logits"):
        output = output.logits
    elif isinstance(output, dict):
        for key in ("logits", "pred", "prediction", "out"):
            if key in output:
                output = output[key]
                break
    if isinstance(output, (tuple, list)):
        output = output[-1]
    if isinstance(output, (tuple, list)):
        output = output[-1]
    if not torch.is_tensor(output):
        raise RuntimeError("BiRefNet returned an unsupported prediction object.")
    if output.ndim == 3:
        output = output.unsqueeze(1)
    if output.ndim != 4:
        raise RuntimeError(f"BiRefNet returned an unexpected tensor shape: {tuple(output.shape)}")
    if output.shape[1] > 1:
        output = output[:, :1, :, :]
    return output


def make_alpha(source: Image.Image) -> Image.Image:
    if MODEL is None:
        raise HTTPException(status_code=503, detail="BiRefNet model is not ready. Check GPU worker startup logs.")
    original_size = source.size
    rgb = source.convert("RGB")
    resized = rgb.resize((IMAGE_SIZE, IMAGE_SIZE), Image.Resampling.BILINEAR)
    array = np.asarray(resized, dtype=np.float32) / 255.0
    tensor = torch.from_numpy(array).permute(2, 0, 1)
    mean = torch.tensor([0.485, 0.456, 0.406], dtype=tensor.dtype).view(3, 1, 1)
    std = torch.tensor([0.229, 0.224, 0.225], dtype=tensor.dtype).view(3, 1, 1)
    tensor = ((tensor - mean) / std).unsqueeze(0).to(DEVICE)
    if DEVICE == "cuda":
        tensor = tensor.half()

    with INFERENCE_LOCK, torch.inference_mode():
        output = MODEL(tensor)
        prediction = extract_prediction(output)
        alpha_tensor = torch.sigmoid(prediction.float())[0, 0].clamp(0, 1).cpu()

    alpha_array = (alpha_tensor.numpy() * 255.0).round().astype(np.uint8)
    alpha = Image.fromarray(alpha_array, mode="L").resize(original_size, Image.Resampling.LANCZOS)
    if source.mode == "RGBA":
        alpha = ImageChops.multiply(alpha, source.getchannel("A"))
    return alpha


def render_output(source_bytes: bytes, mode: str, background_color: str, background_bytes: Optional[bytes]) -> bytes:
    source = read_image(source_bytes, "Source image")
    if mode not in {"transparent", "solid", "image"}:
        raise HTTPException(status_code=400, detail="Mode must be transparent, solid or image.")
    alpha = make_alpha(source)
    foreground = source.convert("RGBA")
    foreground.putalpha(alpha)

    if mode == "transparent":
        final = foreground
    elif mode == "solid":
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", background_color or ""):
            raise HTTPException(status_code=400, detail="A valid six-digit background colour is required.")
        colour = tuple(int(background_color[index:index + 2], 16) for index in (1, 3, 5)) + (255,)
        final = Image.new("RGBA", source.size, colour)
        final.alpha_composite(foreground)
    else:
        if not background_bytes:
            raise HTTPException(status_code=400, detail="An image background is required for image mode.")
        background = read_image(background_bytes, "Replacement background")
        canvas = ImageOps.fit(background.convert("RGBA"), source.size, method=Image.Resampling.LANCZOS)
        final = canvas
        final.alpha_composite(foreground)

    output = io.BytesIO()
    final.save(output, format="PNG", optimize=True)
    return output.getvalue()


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "Soft3TT BiRefNet GPU worker",
        "inference_ready": MODEL is not None,
        "model": MODEL_ID,
        "device": DEVICE,
        "error": MODEL_ERROR,
    }


@app.post("/v1/remove-background")
async def remove_background(
    files: list[UploadFile] = File(default=[]),
    file: Optional[UploadFile] = File(default=None),
    background: Optional[UploadFile] = File(default=None),
    mode: str = Form("transparent"),
    backgroundColor: str = Form("#ffffff"),
    authorization: Optional[str] = Header(default=None),
):
    authorize(authorization)
    selected = files or ([file] if file else [])
    if not selected or len(selected) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"Submit between 1 and {MAX_FILES} images.")
    if mode not in {"transparent", "solid", "image"}:
        raise HTTPException(status_code=400, detail="Unsupported background mode.")
    if mode == "solid" and not re.fullmatch(r"#[0-9a-fA-F]{6}", backgroundColor or ""):
        raise HTTPException(status_code=400, detail="Invalid background colour.")
    if mode == "image" and background is None:
        raise HTTPException(status_code=400, detail="An image background is required.")

    image_payloads = []
    total_size = 0
    for uploaded in selected:
        data = await uploaded.read(MAX_FILE_BYTES + 1)
        total_size += len(data)
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="Each source image must be 15 MB or smaller.")
        image_payloads.append((uploaded.filename or "image", data))
    if total_size > MAX_BATCH_BYTES:
        raise HTTPException(status_code=413, detail="Total batch upload is too large.")

    background_bytes = None
    if background is not None:
        background_bytes = await background.read(MAX_FILE_BYTES + 1)
        if len(background_bytes) > MAX_FILE_BYTES:
            raise HTTPException(status_code=413, detail="Replacement background must be 15 MB or smaller.")

    if len(image_payloads) == 1:
        filename, raw = image_payloads[0]
        result = await run_in_threadpool(render_output, raw, mode, backgroundColor, background_bytes)
        output_name = f"Soft3TT-{safe_stem(filename)}-background-removed.png"
        return Response(
            content=result,
            media_type="image/png",
            headers={"Content-Disposition": f'attachment; filename="{output_name}"', "Cache-Control": "no-store"},
        )

    archive = io.BytesIO()
    with zipfile.ZipFile(archive, mode="w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for index, (filename, raw) in enumerate(image_payloads, start=1):
            result = await run_in_threadpool(render_output, raw, mode, backgroundColor, background_bytes)
            zip_file.writestr(f"{index:02d}-Soft3TT-{safe_stem(filename)}.png", result)
    archive.seek(0)
    return StreamingResponse(
        archive,
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="Soft3TT-background-removal-batch.zip"', "Cache-Control": "no-store"},
    )
