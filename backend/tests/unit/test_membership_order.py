"""Pure Spanish ordering without a database or a process locale mutation."""

from users.membership import spanish_name_key


def test_spanish_primary_order_folds_accents_and_preserves_enye():
    names = ["Óscar", "Ñora", "Nora", "Álvaro", "Bruna", "Olivia"]
    assert sorted(names, key=spanish_name_key) == [
        "Álvaro",
        "Bruna",
        "Nora",
        "Ñora",
        "Olivia",
        "Óscar",
    ]
    assert spanish_name_key("Álvaro")[0] == spanish_name_key("alvaro")[0]
    assert spanish_name_key("Ñora")[0] == spanish_name_key("N\u0303ora")[0]


def test_spanish_tie_breaking_is_deterministic_without_input_order():
    names = ["Álvaro", "alvaro", "Alvaro"]
    assert sorted(names, key=spanish_name_key) == ["Alvaro", "alvaro", "Álvaro"]
    assert sorted(reversed(names), key=spanish_name_key) == [
        "Alvaro",
        "alvaro",
        "Álvaro",
    ]
