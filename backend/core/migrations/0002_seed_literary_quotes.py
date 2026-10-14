"""Two short original-language excerpts; evidence in docs/literary-quotes.md."""

from django.db import migrations

SEEDS = [
    (
        "No hay libro tan malo que no tenga algo bueno.",
        "Don Quijote de la Mancha, II, 3 (1615)",
    ),
    (
        "El que lee mucho y anda mucho, vee mucho y sabe mucho.",
        "Don Quijote de la Mancha, II, 25 (1615)",
    ),
]


def seed(apps, schema_editor):
    quote = apps.get_model("core", "LiteraryQuote")
    for text, source in SEEDS:
        quote.objects.using(schema_editor.connection.alias).get_or_create(
            normalized_text=" ".join(text.split()).lower(),
            defaults={
                "text": text,
                "author": "Miguel de Cervantes",
                "source": source,
                "active": True,
            },
        )


def unseed(apps, schema_editor):
    quote = apps.get_model("core", "LiteraryQuote")
    for text, source in SEEDS:
        quote.objects.using(schema_editor.connection.alias).filter(
            text=text, source=source, author="Miguel de Cervantes"
        ).delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0001_initial")]
    operations = [migrations.RunPython(seed, unseed)]
