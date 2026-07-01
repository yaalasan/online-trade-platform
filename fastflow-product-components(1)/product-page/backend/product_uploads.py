"""
product_uploads.py — Flask blueprint for R2 presigned media uploads.

Frontend flow (see MediaUploader.tsx):
  1. POST /api/products/<id>/media/presign  -> returns { uploadUrl, url, thumbUrl, id }
  2. Browser PUTs the file bytes straight to R2 using uploadUrl
  3. Frontend appends the returned media row and persists product order

R2 is S3-compatible, so we use boto3. Set these env vars:
  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE
  (R2_PUBLIC_BASE is your public bucket/CDN base, e.g. https://media.fastflow.global)
"""

import os
import uuid
import boto3
from botocore.config import Config
from flask import Blueprint, request, jsonify, abort

bp = Blueprint("product_uploads", __name__)

# ---- security: allowlist mime types + size caps (mirror the frontend) -------
ALLOWED = {
    "image": {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"},
    "video": {"video/mp4": "mp4", "video/webm": "webm"},
    "360":   {"image/jpeg": "jpg", "image/png": "png"},
}
MAX_BYTES = {"image": 25 * 1024 * 1024, "video": 200 * 1024 * 1024, "360": 40 * 1024 * 1024}

_s3 = boto3.client(
    "s3",
    endpoint_url=f"https://{os.environ['R2_ACCOUNT_ID']}.r2.cloudflarestorage.com",
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"),
    region_name="auto",
)
_BUCKET = os.environ["R2_BUCKET"]
_PUBLIC = os.environ["R2_PUBLIC_BASE"].rstrip("/")


def current_user():
    """Replace with your real auth. MUST authorize server-side (spec C1)."""
    # e.g. return get_user_from_session()
    raise NotImplementedError


def user_owns_product(user, product_id: str) -> bool:
    """Replace with a real ownership check to prevent IDOR (spec C1)."""
    raise NotImplementedError


@bp.post("/api/products/<product_id>/media/presign")
def presign(product_id: str):
    user = current_user()
    if not user:
        abort(401)
    if not user_owns_product(user, product_id):
        abort(403)

    data = request.get_json(silent=True) or {}
    kind = data.get("kind")
    content_type = data.get("contentType")
    size = int(data.get("size", 0))

    # validate against the allowlist — never trust the client
    if kind not in ALLOWED:
        abort(400, "Invalid media kind.")
    if content_type not in ALLOWED[kind]:
        abort(400, "Unsupported content type.")
    if size <= 0 or size > MAX_BYTES[kind]:
        abort(400, "File too large.")

    ext = ALLOWED[kind][content_type]
    media_id = str(uuid.uuid4())
    key = f"products/{product_id}/{media_id}.{ext}"

    # presigned PUT — content type is bound into the signature, so the browser
    # cannot upload a different type than we approved
    upload_url = _s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": _BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=600,  # 10 min
    )

    public_url = f"{_PUBLIC}/{key}"
    # For a real thumbnail: enqueue a Celery task to fetch the object, resize,
    # and write products/<id>/<media_id>_thumb.webp, then patch thumbUrl.
    thumb_url = public_url  # placeholder until the thumbnail job runs

    return jsonify({
        "id": media_id,
        "uploadUrl": upload_url,
        "url": public_url,
        "thumbUrl": thumb_url,
        "key": key,
    })


# Register in your app factory:
#   from product_uploads import bp as uploads_bp
#   app.register_blueprint(uploads_bp)
