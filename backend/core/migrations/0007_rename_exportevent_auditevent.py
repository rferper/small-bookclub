"""Preserve existing export IDs, timestamps and immutable attribution."""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("core", "0006_exportevent")]
    operations = [migrations.RenameModel(old_name="ExportEvent", new_name="AuditEvent")]
