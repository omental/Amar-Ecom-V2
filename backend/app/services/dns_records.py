from __future__ import annotations

import ipaddress
import re
import shlex
from dataclasses import dataclass

from app.core.config import settings
from app.core.domains import HOST_LABEL_PATTERN, InvalidHostname, normalize_hostname


SUPPORTED_DNS_RECORD_TYPES = frozenset({"A", "AAAA", "CNAME", "TXT", "MX", "CAA", "SRV"})
SYSTEM_DNS_RECORD_TYPES = SUPPORTED_DNS_RECORD_TYPES | {"ALIAS"}
CAA_PATTERN = re.compile(r"^(?P<flags>\d{1,3})\s+(?P<tag>issue|issuewild|iodef)\s+\"?(?P<value>[^\"]+)\"?$", re.IGNORECASE)


class InvalidDnsRecord(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class NormalizedDnsRecord:
    record_type: str
    name: str
    content: str
    ttl: int
    priority: int | None = None
    weight: int | None = None
    port: int | None = None


def normalize_record_name(value: str, zone_name: str) -> str:
    raw = (value or "").strip().rstrip(".").lower()
    zone = normalize_hostname(zone_name)
    if raw in {"", "@", zone}:
        return "@"
    if raw.endswith(f".{zone}"):
        raw = raw[: -(len(zone) + 1)]
    labels = raw.split(".")
    if len(raw) > 253 or any(
        label != "*" and not (label.startswith("_") and HOST_LABEL_PATTERN.fullmatch(label[1:])) and not HOST_LABEL_PATTERN.fullmatch(label)
        for label in labels
    ):
        raise InvalidDnsRecord("Invalid DNS record name")
    if "*" in labels and labels[0] != "*":
        raise InvalidDnsRecord("A wildcard is only valid as the left-most label")
    return raw


def absolute_record_name(name: str, zone_name: str) -> str:
    zone = normalize_hostname(zone_name)
    return zone if name == "@" else f"{name}.{zone}"


def normalize_record(
    *,
    record_type: str,
    name: str,
    content: str,
    zone_name: str,
    ttl: int | None = None,
    priority: int | None = None,
    weight: int | None = None,
    port: int | None = None,
    allow_system_alias: bool = False,
) -> NormalizedDnsRecord:
    kind = (record_type or "").strip().upper()
    supported = SYSTEM_DNS_RECORD_TYPES if allow_system_alias else SUPPORTED_DNS_RECORD_TYPES
    if kind not in supported:
        raise InvalidDnsRecord(f"Unsupported DNS record type: {kind or 'empty'}")
    relative_name = normalize_record_name(name, zone_name)
    normalized_ttl = settings.DNS_DEFAULT_TTL if ttl is None else ttl
    if not settings.DNS_MIN_TTL <= normalized_ttl <= settings.DNS_MAX_TTL:
        raise InvalidDnsRecord(f"TTL must be between {settings.DNS_MIN_TTL} and {settings.DNS_MAX_TTL}")
    raw_content = (content or "").strip()
    if not raw_content or "\x00" in raw_content or "\n" in raw_content or "\r" in raw_content:
        raise InvalidDnsRecord("DNS record value is required and must be one line")

    normalized_priority = _bounded(priority, "priority")
    normalized_weight = _bounded(weight, "weight")
    normalized_port = _bounded(port, "port")
    if kind == "A":
        try:
            parsed = ipaddress.ip_address(raw_content)
        except ValueError as exc:
            raise InvalidDnsRecord("A records require a valid IPv4 address") from exc
        if not isinstance(parsed, ipaddress.IPv4Address):
            raise InvalidDnsRecord("A records require a valid IPv4 address")
        value = str(parsed)
    elif kind == "AAAA":
        try:
            parsed = ipaddress.ip_address(raw_content)
        except ValueError as exc:
            raise InvalidDnsRecord("AAAA records require a valid IPv6 address") from exc
        if not isinstance(parsed, ipaddress.IPv6Address):
            raise InvalidDnsRecord("AAAA records require a valid IPv6 address")
        value = str(parsed)
    elif kind in {"CNAME", "ALIAS", "MX", "SRV"}:
        try:
            value = normalize_hostname(raw_content)
        except InvalidHostname as exc:
            raise InvalidDnsRecord(f"{kind} records require a valid target hostname") from exc
        if kind == "CNAME" and relative_name == "@":
            raise InvalidDnsRecord("A zone apex cannot use an ordinary CNAME; use Amar's managed ALIAS routing")
        if kind == "MX" and priority is None:
            raise InvalidDnsRecord("MX records require priority")
        if kind == "SRV" and any(item is None for item in (priority, weight, port)):
            raise InvalidDnsRecord("SRV records require priority, weight, and port")
    elif kind == "CAA":
        match = CAA_PATTERN.fullmatch(raw_content)
        if not match or int(match.group("flags")) > 255:
            raise InvalidDnsRecord('CAA value must look like: 0 issue "letsencrypt.org"')
        value = f'{int(match.group("flags"))} {match.group("tag").lower()} "{match.group("value")}"'
    else:
        if len(raw_content.encode("utf-8")) > 2048:
            raise InvalidDnsRecord("TXT record value is too large")
        value = raw_content

    return NormalizedDnsRecord(kind, relative_name, value, normalized_ttl, normalized_priority, normalized_weight, normalized_port)


def validate_record_set(records: list[NormalizedDnsRecord]) -> None:
    if len(records) > settings.DNS_MAX_RECORDS_PER_ZONE:
        raise InvalidDnsRecord(f"A zone may contain at most {settings.DNS_MAX_RECORDS_PER_ZONE} records")
    by_name: dict[str, set[str]] = {}
    for record in records:
        by_name.setdefault(record.name, set()).add(record.record_type)
    for name, kinds in by_name.items():
        if "CNAME" in kinds and len(kinds) > 1:
            raise InvalidDnsRecord(f"{name} cannot contain CNAME and other record types")


def parse_zone_file(source: str, zone_name: str) -> tuple[list[NormalizedDnsRecord], list[str], list[str]]:
    if len(source.encode("utf-8")) > 500_000:
        raise InvalidDnsRecord("Zone file is too large")
    records: list[NormalizedDnsRecord] = []
    warnings: list[str] = []
    unsupported: list[str] = []
    current_origin = normalize_hostname(zone_name)
    default_ttl = settings.DNS_DEFAULT_TTL
    last_name = "@"
    for line_number, raw_line in enumerate(source.splitlines(), 1):
        line = raw_line.strip()
        if not line or line.startswith(";"):
            continue
        if line.upper().startswith(("$INCLUDE", "$GENERATE")):
            raise InvalidDnsRecord(f"Dangerous zone-file directive rejected on line {line_number}")
        if line.upper().startswith("$ORIGIN"):
            parts = line.split()
            if len(parts) != 2 or normalize_hostname(parts[1]) != normalize_hostname(zone_name):
                raise InvalidDnsRecord("Imported $ORIGIN must match this DNS zone")
            current_origin = normalize_hostname(parts[1])
            continue
        if line.upper().startswith("$TTL"):
            parts = line.split()
            if len(parts) != 2 or not parts[1].isdigit():
                raise InvalidDnsRecord(f"Invalid $TTL on line {line_number}")
            default_ttl = int(parts[1])
            continue
        line = _strip_zone_comment(line).strip()
        try:
            tokens = shlex.split(line, posix=True)
        except ValueError as exc:
            raise InvalidDnsRecord(f"Invalid quoting on line {line_number}") from exc
        type_index = next((index for index, token in enumerate(tokens) if token.upper() in SYSTEM_DNS_RECORD_TYPES | {"NS", "SOA"}), None)
        if type_index is None:
            unsupported.append(f"Line {line_number}: unsupported or malformed record")
            continue
        kind = tokens[type_index].upper()
        if kind in {"SOA", "NS", "ALIAS"}:
            unsupported.append(f"Line {line_number}: {kind} is controlled by Amar or unsupported for import")
            continue
        prefix = tokens[:type_index]
        name = prefix[0] if prefix and not prefix[0].isdigit() and prefix[0].upper() != "IN" else last_name
        if name.endswith("."):
            name = name.rstrip(".")
        last_name = name
        ttl = next((int(token) for token in prefix if token.isdigit()), default_ttl)
        values = tokens[type_index + 1 :]
        if not values:
            raise InvalidDnsRecord(f"Missing record value on line {line_number}")
        priority = weight = port = None
        if kind == "MX":
            if len(values) < 2 or not values[0].isdigit():
                raise InvalidDnsRecord(f"Invalid MX on line {line_number}")
            priority, content = int(values[0]), values[1]
        elif kind == "SRV":
            if len(values) < 4 or not all(item.isdigit() for item in values[:3]):
                raise InvalidDnsRecord(f"Invalid SRV on line {line_number}")
            priority, weight, port, content = int(values[0]), int(values[1]), int(values[2]), values[3]
        else:
            content = " ".join(values)
        records.append(normalize_record(record_type=kind, name=name, content=content.rstrip("."), zone_name=current_origin, ttl=ttl, priority=priority, weight=weight, port=port))
    validate_record_set(records)
    if not records:
        warnings.append("No supported merchant records were found")
    return records, warnings, unsupported


def _bounded(value: int | None, label: str) -> int | None:
    if value is None:
        return None
    if not 0 <= value <= 65535:
        raise InvalidDnsRecord(f"DNS {label} must be between 0 and 65535")
    return value


def _strip_zone_comment(line: str) -> str:
    quoted = False
    escaped = False
    for index, character in enumerate(line):
        if escaped:
            escaped = False
            continue
        if character == "\\":
            escaped = True
            continue
        if character == '"':
            quoted = not quoted
        elif character == ";" and not quoted:
            return line[:index]
    return line
