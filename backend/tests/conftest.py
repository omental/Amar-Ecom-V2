import os
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("AMAR_ECOM_TESTING", "1")
os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("STOREFRONT_ALLOW_LEGACY_FALLBACK", "true")

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
