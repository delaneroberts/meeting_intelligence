from pathlib import Path

from backend.services import export


def test_save_load_delete_artifacts(tmp_path: Path):
    export.set_transcript_folder(str(tmp_path))
    meeting_id = export.new_meeting_id()

    export.save_meeting_artifacts(
        meeting_id=meeting_id,
        filename="audio.m4a",
        transcript="hello",
        summary="summary",
        action_items=["item 1"],
        original_language="English",
        was_translated=False,
        memo_json={"title": "Test"},
    )

    data = export.load_meeting_artifacts(meeting_id)
    assert data["meeting_id"] == meeting_id
    assert data["summary"] == "summary"
    assert data["action_items"] == ["item 1"]

    export.delete_meeting_artifacts(meeting_id)
    assert not (tmp_path / f"{meeting_id}.json").exists()
