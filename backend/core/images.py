"""Shared content validation and re-encoding for private uploaded images."""

import io

from PIL import Image, UnidentifiedImageError

IMAGE_TYPES = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
MAX_IMAGE_BYTES = 2 * 1024 * 1024
IMAGE_MAX_PIXELS = 16_000_000


def encode_image(upload):
    if upload.content_type not in IMAGE_TYPES or not 0 < upload.size <= MAX_IMAGE_BYTES:
        raise ValueError("Invalid image upload")
    data = upload.read(MAX_IMAGE_BYTES + 1)
    if not 0 < len(data) <= MAX_IMAGE_BYTES:
        raise ValueError("Invalid image size")
    try:
        with Image.open(io.BytesIO(data)) as source:
            if source.format != IMAGE_TYPES[upload.content_type]:
                raise ValueError("Image type mismatch")
            if source.width * source.height > IMAGE_MAX_PIXELS:
                raise ValueError("Image dimensions too large")
            source.load()
            clean = source.convert("RGBA" if "A" in source.getbands() else "RGB")
            output = io.BytesIO()
            clean.save(output, format="WEBP", quality=85)
            return output.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as error:
        raise ValueError("Invalid image data") from error
