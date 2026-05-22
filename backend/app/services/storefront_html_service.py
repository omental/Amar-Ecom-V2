from html.parser import HTMLParser


ALLOWED_TAGS = {"p", "br", "strong", "em", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "a"}
ALLOWED_ATTRS = {"a": {"href", "target", "rel"}}
SELF_CLOSING_TAGS = {"br"}
BLOCKED_TAGS = {"script", "iframe", "style"}
SAFE_URL_PREFIXES = ("http://", "https://", "/", "#", "mailto:", "tel:")


def _escape_html(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _sanitize_url(url: str) -> str | None:
    candidate = (url or "").strip()
    if not candidate:
        return None
    lowered = candidate.lower()
    if lowered.startswith("javascript:"):
        return None
    if candidate.startswith(SAFE_URL_PREFIXES):
        return candidate
    return None


class _SafeHtmlSanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.blocked_depth = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized = tag.lower()
        if normalized in BLOCKED_TAGS:
            self.blocked_depth += 1
            return
        if self.blocked_depth > 0 or normalized not in ALLOWED_TAGS:
            return

        sanitized_attrs: list[str] = []
        allowed = ALLOWED_ATTRS.get(normalized, set())
        for key, value in attrs:
            attr_name = key.lower()
            if attr_name.startswith("on") or attr_name not in allowed:
                continue
            if normalized == "a" and attr_name == "href":
                safe_url = _sanitize_url(value or "")
                if not safe_url:
                    continue
                sanitized_attrs.append(f' href="{_escape_html(safe_url)}"')
                continue
            if attr_name == "target":
                target = (value or "").strip()
                if target not in {"_self", "_blank"}:
                    continue
                sanitized_attrs.append(f' target="{target}"')
                continue
            if attr_name == "rel":
                rel = (value or "").strip()
                if rel:
                    sanitized_attrs.append(f' rel="{_escape_html(rel)}"')

        if normalized == "a" and not any(attr.startswith(" href=") for attr in sanitized_attrs):
            sanitized_attrs.append(' href="#"')
        if normalized == "a" and any(attr == ' target="_blank"' for attr in sanitized_attrs):
            sanitized_attrs.append(' rel="noopener noreferrer"')

        joined_attrs = "".join(dict.fromkeys(sanitized_attrs))
        if normalized in SELF_CLOSING_TAGS:
            self.parts.append(f"<{normalized}{joined_attrs}>")
        else:
            self.parts.append(f"<{normalized}{joined_attrs}>")

    def handle_endtag(self, tag: str) -> None:
        normalized = tag.lower()
        if normalized in BLOCKED_TAGS:
            if self.blocked_depth > 0:
                self.blocked_depth -= 1
            return
        if self.blocked_depth > 0 or normalized not in ALLOWED_TAGS or normalized in SELF_CLOSING_TAGS:
            return
        self.parts.append(f"</{normalized}>")

    def handle_data(self, data: str) -> None:
        if self.blocked_depth == 0:
            self.parts.append(_escape_html(data))

    def handle_entityref(self, name: str) -> None:
        if self.blocked_depth == 0:
            self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if self.blocked_depth == 0:
            self.parts.append(f"&#{name};")


def sanitize_storefront_html(content: str | None) -> str | None:
    if content is None:
        return None
    sanitizer = _SafeHtmlSanitizer()
    sanitizer.feed(content)
    sanitizer.close()
    return "".join(sanitizer.parts).strip()
