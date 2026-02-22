"""
Database models for Meeting Assistant.

Schema design supports multi-user architecture for future expansion,
with single-user support for Phase 1.
Consolidated in backend/models for a clean, scalable structure.
"""

from datetime import datetime
import uuid
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    """
    User model (created but not exposed to UI in Phase 1).
    """
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_premium = db.Column(db.Boolean, default=False)
    premium_quota = db.Column(db.Integer, default=0)
    meetings = db.relationship('Meeting', backref='user', lazy=True, cascade='all, delete-orphan')
    settings = db.relationship('Setting', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'is_premium': self.is_premium,
            'premium_quota': self.premium_quota,
        }


class Meeting(db.Model):
    """Store meeting transcripts and summaries."""
    __tablename__ = 'meetings'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, default=1)
    audio_filename = db.Column(db.String(256))
    audio_path = db.Column(db.String(512))
    original_language = db.Column(db.String(50), default='en')
    duration_seconds = db.Column(db.Integer)
    transcript_original = db.Column(db.Text)
    summary_original = db.Column(db.Text)
    action_items_original = db.Column(db.JSON)
    transcript_english = db.Column(db.Text)
    summary_english = db.Column(db.Text)
    action_items_english = db.Column(db.JSON)
    was_translated = db.Column(db.Boolean, default=False)
    memo_json = db.Column(db.JSON)
    meeting_metadata = db.Column(db.JSON)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    exports = db.relationship('ExportHistory', backref='meeting', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'created_at': self.created_at.isoformat(),
            'original_language': self.original_language,
            'was_translated': self.was_translated,
            'summary': self.summary_original,
            'summary_english': self.summary_english,
            'transcript': self.transcript_original,
            'transcript_english': self.transcript_english,
            'action_items': self.action_items_original,
            'action_items_english': self.action_items_english,
            'memo_json': self.memo_json,
            'meeting_metadata': self.meeting_metadata,
        }


class Setting(db.Model):
    """Store admin/user settings (language preferences, etc)."""
    __tablename__ = 'settings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, default=1)
    key = db.Column(db.String(100), nullable=False)
    value = db.Column(db.String(512))
    data_type = db.Column(db.String(20), default='string')
    __table_args__ = (db.UniqueConstraint('user_id', 'key', name='uq_user_setting'),)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @staticmethod
    def get(key, user_id=1, default=None):
        setting = Setting.query.filter_by(user_id=user_id, key=key).first()
        if setting:
            if setting.data_type == 'bool':
                return setting.value.lower() in ('true', '1', 'yes')
            elif setting.data_type == 'int':
                return int(setting.value)
            elif setting.data_type == 'json':
                import json
                return json.loads(setting.value)
            return setting.value
        return default

    @staticmethod
    def set(key, value, data_type='string', user_id=1):
        setting = Setting.query.filter_by(user_id=user_id, key=key).first()
        if setting:
            setting.value = str(value)
            setting.data_type = data_type
        else:
            setting = Setting(user_id=user_id, key=key, value=str(value), data_type=data_type)
        db.session.add(setting)
        db.session.commit()
        return setting

    def to_dict(self):
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'data_type': self.data_type,
            'updated_at': self.updated_at.isoformat(),
        }


class ExportHistory(db.Model):
    """Track exports of meetings (PDF, email, etc)."""
    __tablename__ = 'export_history'

    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.String(36), db.ForeignKey('meetings.id'), nullable=False)
    export_type = db.Column(db.String(50))
    recipient = db.Column(db.String(256))
    status = db.Column(db.String(20))
    error_message = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'export_type': self.export_type,
            'recipient': self.recipient,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
        }


class ProcessJob(db.Model):
    """
    Persistent store for async process job progress.
    Survives process restarts (e.g. Flask reloader) so status polling always finds the job.
    """
    __tablename__ = 'process_jobs'

    job_id = db.Column(db.String(128), primary_key=True)
    status = db.Column(db.String(32), nullable=False, default='processing')
    progress = db.Column(db.Float, default=0.0)
    message = db.Column(db.String(256), default='')
    result = db.Column(db.JSON)
    error = db.Column(db.Text)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_status_dict(self):
        d = {
            'status': self.status,
            'progress': self.progress,
            'message': self.message or '',
        }
        if self.result is not None:
            d['result'] = self.result
        if self.error is not None:
            d['error'] = self.error
        return d


class MeetingTemplate(db.Model):
    """Store custom meeting summary templates (prompt text)."""
    __tablename__ = 'meeting_templates'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), unique=True, nullable=False)
    prompt_text = db.Column(db.Text, nullable=False)
    is_default = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        """Full representation including prompt_text (for GET by id / editing)."""
        return {
            'id': self.id,
            'name': self.name,
            'prompt_text': self.prompt_text,
            'is_default': self.is_default,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }

    def to_list_item(self):
        """List representation: id, name, is_default only."""
        return {
            'id': self.id,
            'name': self.name,
            'is_default': self.is_default,
        }


__all__ = ['db', 'User', 'Meeting', 'Setting', 'ExportHistory', 'ProcessJob', 'MeetingTemplate']
