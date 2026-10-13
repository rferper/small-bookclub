"""Copy legacy attendance before replacing its implicit through relation."""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def forward(apps, schema_editor):
    legacy = apps.get_model("meetings", "Meeting").attendees.through
    target = apps.get_model("meetings", "MeetingAttendance")
    alias = schema_editor.connection.alias
    target.objects.using(alias).bulk_create(
        [
            target(meeting_id=row.meeting_id, member_id=row.user_id)
            for row in legacy.objects.using(alias).all()
        ]
    )


def reverse(apps, schema_editor):
    legacy = apps.get_model("meetings", "Meeting").attendees.through
    source = apps.get_model("meetings", "MeetingAttendance")
    alias = schema_editor.connection.alias
    legacy.objects.using(alias).bulk_create(
        [
            legacy(meeting_id=row.meeting_id, user_id=row.member_id)
            for row in source.objects.using(alias).all()
        ]
    )


class Migration(migrations.Migration):
    dependencies = [
        ("meetings", "0003_readingcompletion"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name="MeetingAttendance",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "meeting",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to="meetings.meeting",
                    ),
                ),
                (
                    "member",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "constraints": [
                    models.UniqueConstraint(
                        fields=("meeting", "member"),
                        name="meeting_attendance_unique_pair",
                    )
                ]
            },
        ),
        migrations.RunPython(forward, reverse),
        migrations.RemoveField(model_name="meeting", name="attendees"),
        migrations.AddField(
            model_name="meeting",
            name="attendees",
            field=models.ManyToManyField(
                blank=True,
                related_name="attended_meetings",
                through="meetings.MeetingAttendance",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
