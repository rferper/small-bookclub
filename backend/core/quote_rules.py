"""Pure literal quote input normalization, with no attribution inference."""


def normalize_quote(value):
    if not isinstance(value, dict) or set(value) != {
        "text",
        "author",
        "source",
        "active",
    }:
        raise ValueError("Invalid quote fields")
    if type(value["active"]) is not bool:
        raise ValueError("Invalid enabled flag")
    result = {"active": value["active"]}
    for field, limit in [("text", 1000), ("author", 200), ("source", 200)]:
        raw = value[field]
        if raw is None and field != "text":
            result[field] = None
            continue
        if not isinstance(raw, str) or "\x00" in raw:
            raise ValueError("Invalid quote text")
        raw.encode("utf-8")
        raw = raw.strip()
        if len(raw) > limit or (field == "text" and not raw):
            raise ValueError("Invalid quote length")
        result[field] = raw or None
    return result


def quote_key(text):
    return " ".join(text.split()).lower()
