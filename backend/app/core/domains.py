from __future__ import annotations

import re
import ipaddress
from urllib.parse import urlsplit

from publicsuffix2 import PublicSuffixList


RESERVED_PLATFORM_LABELS = frozenset({
    "admin", "api", "app", "assets", "auth", "billing", "cdn", "dashboard",
    "dev", "docs", "ftp", "help", "imap", "localhost", "login", "mail",
    "media", "ns1", "ns2", "ns3", "pop", "pricing", "signup", "smtp",
    "staging", "static", "status", "support", "test", "www",
})
HOST_LABEL_PATTERN = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
PUBLIC_SUFFIX_LIST = PublicSuffixList()


class InvalidHostname(ValueError):
    pass


def normalize_hostname(value: str) -> str:
    """Return the canonical ASCII hostname; protocols, paths and ports are rejected."""
    raw = (value or "").strip().rstrip(".")
    if not raw or len(raw) > 253 or "://" in raw or any(char in raw for char in "/?#@"):
        raise InvalidHostname("Invalid hostname")
    if ":" in raw:
        raise InvalidHostname("Invalid hostname")
    try:
        hostname = raw.encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise InvalidHostname("Invalid hostname") from exc
    labels = hostname.split(".")
    if len(hostname) > 253 or any(not HOST_LABEL_PATTERN.fullmatch(label) for label in labels):
        raise InvalidHostname("Invalid hostname")
    return hostname


def normalize_request_hostname(value: str) -> str:
    raw = (value or "").strip().rstrip(".")
    if ":" in raw:
        # Host headers may contain a port. IPv6 literals are not Store domains.
        host, separator, port = raw.rpartition(":")
        if not separator or not host or not port.isdigit():
            raise InvalidHostname("Invalid hostname")
        raw = host.rstrip(".")
    return normalize_hostname(raw)


def hostname_from_origin(value: str | None) -> str | None:
    if not value:
        return None
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    try:
        return normalize_hostname(parsed.hostname)
    except InvalidHostname:
        return None


def platform_hostname(store_slug: str, base_domain: str) -> str:
    base = normalize_hostname(base_domain)
    if base == "localhost":
        return normalize_hostname(f"{store_slug}.localhost")
    return normalize_hostname(f"{store_slug}.{base}")


def is_reserved_platform_hostname(hostname: str, base_domain: str) -> bool:
    host = normalize_hostname(hostname)
    base = normalize_hostname(base_domain)
    if host in {base, f"www.{base}"}:
        return True
    suffix = f".{base}"
    if not host.endswith(suffix):
        return False
    label = host[: -len(suffix)]
    return "." in label or label in RESERVED_PLATFORM_LABELS


def registrable_domain(hostname: str) -> str:
    """Return the PSL-backed registrable domain, rejecting suffixes and local/IP names."""
    host = normalize_hostname(hostname)
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise InvalidHostname("IP addresses cannot be connected as custom domains")
    suffix = PUBLIC_SUFFIX_LIST.get_tld(host, strict=True)
    registrable = PUBLIC_SUFFIX_LIST.get_sld(host, strict=True)
    if not suffix or not registrable or registrable == suffix:
        raise InvalidHostname("Enter a registrable public domain")
    return normalize_hostname(registrable)


def normalize_custom_hostname(value: str, *, platform_base_domain: str) -> str:
    host = normalize_hostname(value)
    base = normalize_hostname(platform_base_domain)
    if host == base or host.endswith(f".{base}"):
        raise InvalidHostname("Amar platform hostnames cannot be claimed")
    registrable_domain(host)
    return host
