"""Compatibility exports for API routes.

Persistence helpers live in ``app.core`` so domain services never need to import
the API package (which imports the complete router graph).
"""

from app.core.persistence import (
    commit_or_409,
    ensure_no_duplicates,
    ensure_unique,
    fetch_one_or_404,
    normalize_pagination,
)

__all__ = [
    "commit_or_409",
    "ensure_no_duplicates",
    "ensure_unique",
    "fetch_one_or_404",
    "normalize_pagination",
]
