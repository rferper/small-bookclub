import pytest

from core.quote_rules import normalize_quote, quote_key

VALID = {"text": "  Cita ficticia.  ", "author": "  ", "source": None, "active": True}


def test_literal_trimmed_input_and_case_whitespace_duplicate_key():
    assert normalize_quote(VALID) == {
        "text": "Cita ficticia.",
        "author": None,
        "source": None,
        "active": True,
    }
    assert quote_key("  ÁRBOL\n DEL\tLIBRO  ") == "árbol del libro"
    assert (
        normalize_quote({**VALID, "text": "<b>Cita ficticia</b>"})["text"]
        == "<b>Cita ficticia</b>"
    )


@pytest.mark.parametrize(
    "change",
    [
        {"text": " "},
        {"text": None},
        {"text": "x" * 1001},
        {"author": "x" * 201},
        {"source": "x" * 201},
        {"active": 1},
        {"active": "true"},
        {"text": "\x00"},
        {"author": "\ud800"},
        {"unexpected": "forged"},
    ],
)
def test_invalid_quote_inputs_are_refused(change):
    with pytest.raises((ValueError, UnicodeError)):
        normalize_quote({**VALID, **change})


def test_length_is_checked_after_trim_and_all_fields_are_required():
    assert (
        normalize_quote({**VALID, "text": " " + "x" * 1000 + " "})["text"] == "x" * 1000
    )
    with pytest.raises(ValueError):
        normalize_quote({"text": "Fictional", "active": True})
