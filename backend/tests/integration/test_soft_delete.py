"""Real SQL lifecycle checks on a disposable concrete test-only content model."""

from datetime import datetime, timedelta
from datetime import timezone as datetime_timezone

import pytest
from django.core.exceptions import PermissionDenied
from django.db import IntegrityError, connection, models, transaction
from django.test.utils import isolate_apps
from django.utils import timezone

from core.models import RestoreExpired, SoftDeleteModel
from users.models import User

pytestmark = [pytest.mark.integration, pytest.mark.django_db(transaction=True)]
INSTANT = datetime(2026, 3, 15, 12, 30, tzinfo=datetime_timezone.utc)


@pytest.fixture
def content_model(transactional_db):
    with isolate_apps("core", "users") as isolated:
        isolated.register_model("users", User)

        class ContentProbe(SoftDeleteModel):
            title = models.CharField(max_length=100)

            class Meta(SoftDeleteModel.Meta):
                app_label = "core"
                db_table = "test_soft_delete_content"

        with connection.schema_editor() as editor:
            editor.create_model(ContentProbe)
        try:
            yield ContentProbe
        finally:
            with connection.schema_editor() as editor:
                editor.delete_model(ContentProbe)


@pytest.fixture
def administrator():
    return User.objects.create_user(
        "100000000000000001",
        display_name="Fictional admin",
        role="admin",
        approved=True,
    )


@pytest.fixture
def clock(monkeypatch):
    now = [INSTANT]
    monkeypatch.setattr(timezone, "now", lambda: now[0])
    return now


def test_remove_hides_row_and_restore_clears_only_metadata(
    content_model, administrator, clock
):
    row = content_model.objects.create(title="Fictional content")
    assert row.soft_delete(administrator)
    assert content_model.objects.count() == 0
    assert content_model.all_objects.count() == 1
    assert content_model._base_manager.get(pk=row.pk).title == "Fictional content"
    assert row.deleted_at == INSTANT
    assert row.deleted_by_id == administrator.pk
    assert row.purge_due_at == INSTANT + timedelta(days=30)
    clock[0] += timedelta(days=29)
    assert row.restore(administrator)
    assert content_model.objects.get(pk=row.pk).title == "Fictional content"
    row.refresh_from_db()
    assert row.deleted_at is row.deleted_by_id is row.purge_due_at is None


def test_repeated_deletion_from_stale_instance_preserves_deadline(
    content_model, administrator, clock
):
    row = content_model.objects.create(title="Fictional content")
    stale = content_model.objects.get(pk=row.pk)
    assert row.soft_delete(administrator)
    clock[0] += timedelta(days=1)
    assert stale.soft_delete(administrator) is False
    persisted = content_model.all_objects.get(pk=row.pk)
    assert persisted.deleted_at == INSTANT
    assert persisted.purge_due_at == INSTANT + timedelta(days=30)
    assert persisted.restore(administrator)
    assert row.restore(administrator) is False


@pytest.mark.parametrize(
    "offset,allowed",
    [
        (timedelta(microseconds=-1), True),
        (timedelta(), False),
        (timedelta(seconds=1), False),
    ],
)
def test_restore_deadline_is_exact_and_atomic(
    content_model, administrator, clock, offset, allowed
):
    row = content_model.objects.create(title="Fictional content")
    row.soft_delete(administrator)
    clock[0] = INSTANT + timedelta(days=30) + offset
    if allowed:
        assert row.restore(administrator)
    else:
        with pytest.raises(RestoreExpired):
            row.restore(administrator)
        row.refresh_from_db()
        assert row.deleted_at == INSTANT and row.deleted_by_id == administrator.pk
        assert not content_model.objects.exists()


@pytest.mark.parametrize(
    "state", ["member", "pending", "revoked", "unsaved", "anonymous"]
)
def test_mutations_reload_admin_authority(content_model, administrator, clock, state):
    row = content_model.objects.create(title="Fictional content")
    row.soft_delete(administrator)
    stale_admin = administrator
    if state == "member":
        User.objects.filter(pk=administrator.pk).update(role="member")
    elif state == "pending":
        User.objects.filter(pk=administrator.pk).update(approved=False)
    elif state == "revoked":
        User.objects.filter(pk=administrator.pk).update(
            approved=False, revoked_at=INSTANT
        )
    elif state == "unsaved":
        stale_admin = User(pk=administrator.pk, role="admin", approved=True)
    else:
        stale_admin = None
    for method in [row.restore, row.soft_delete]:
        with pytest.raises(PermissionDenied):
            method(stale_admin)
    row.refresh_from_db()
    assert row.deleted_at == INSTANT


def test_sql_rejects_partial_or_wrong_retention_metadata(
    content_model, administrator, clock
):
    row = content_model.objects.create(title="Fictional content")
    invalid = [
        {"deleted_at": INSTANT},
        {"deleted_by_id": administrator.pk},
        {"purge_due_at": INSTANT + timedelta(days=30)},
        {
            "deleted_at": INSTANT,
            "deleted_by_id": administrator.pk,
            "purge_due_at": INSTANT + timedelta(days=29),
        },
    ]
    for fields in invalid:
        with pytest.raises(IntegrityError), transaction.atomic():
            content_model.all_objects.filter(pk=row.pk).update(**fields)
    assert content_model.objects.count() == 1
    with pytest.raises(IntegrityError), transaction.atomic():
        content_model.all_objects.bulk_create(
            [content_model(title="Invalid", deleted_at=INSTANT)]
        )


def test_restore_validation_failure_preserves_deletion(
    content_model, administrator, clock, monkeypatch
):
    row = content_model.objects.create(title="Fictional content")
    row.soft_delete(administrator)

    def fail_restore(self):
        raise ValueError("Fictional domain conflict")

    monkeypatch.setattr(content_model, "validate_restore", fail_restore)
    with pytest.raises(ValueError, match="domain conflict"):
        row.restore(administrator)
    row.refresh_from_db()
    assert row.deleted_at == INSTANT
    assert content_model.objects.count() == 0


def test_soft_deletion_rolls_back_with_enclosing_transaction(
    content_model, administrator, clock
):
    row = content_model.objects.create(title="Fictional content")
    with pytest.raises(ValueError), transaction.atomic():
        row.soft_delete(administrator)
        raise ValueError("Fictional enclosing failure")
    row.refresh_from_db()
    assert row.deleted_at is None
    assert content_model.objects.count() == 1


def test_accidental_delete_is_refused_and_purge_is_explicit(
    content_model, administrator, clock
):
    row = content_model.objects.create(title="Fictional content")
    with pytest.raises(TypeError):
        row.delete()
    with pytest.raises(TypeError):
        content_model.objects.all().delete()
    row.soft_delete(administrator)
    with pytest.raises(TypeError):
        content_model.all_objects.all().delete()
    assert row.hard_delete()[0] == 1
    row2 = content_model.objects.create(title="Fictional purge")
    row2.soft_delete(administrator)
    assert content_model.all_objects.all().hard_delete()[0] == 1
    assert not content_model.all_objects.exists()
