"""
Database models for Meeting Assistant.

Schema design supports multi-user architecture for future expansion,
with single-user support for Phase 1.
"""

from datetime import datetime
import uuid
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    """
    User model (created but not exposed to UI in Phase 1).
    
    This model is prepared for multi-user support in future phases.
    For Phase 1, default user_id=1 is used for all meetings.
    """
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    meetings = db.relationship('Meeting', backref='user', lazy=True, cascade='all, delete-orphan')
    settings = db.relationship('Setting', backref='user', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
        }


class Meeting(db.Model):
    """
    Store meeting transcripts and summaries.
    
    Supports multi-user via user_id field (Phase 1: all records use user_id=1).
    """
    __tablename__ = 'meetings'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, default=1)
    
    # Audio info
    audio_filename = db.Column(db.String(256))
    audio_path = db.Column(db.String(512))
    original_language = db.Column(db.String(50), default='en')
    duration_seconds = db.Column(db.Integer)
    
    # Original content (in detected language)
    transcript_original = db.Column(db.Text)
    summary_original = db.Column(db.Text)
    action_items_original = db.Column(db.JSON)
    
    # English translations (if needed)
    transcript_english = db.Column(db.Text)
    summary_english = db.Column(db.Text)
    action_items_english = db.Column(db.JSON)
    
    # Was the content translated?
    was_translated = db.Column(db.Boolean, default=False)
    
    # Structured memo
    memo_json = db.Column(db.JSON)
    
    # Metadata
    metadata = db.Column(db.JSON)  # {agenda: "", attendees: "", meeting_type: "", etc}
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    exports = db.relationship('ExportHistory', backref='meeting', lazy=True, cascade='all, delete-orphan')
    
    def to_dict(self):
        """Serialize meeting to dictionary."""
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
        }


class Setting(db.Model):
    """
    Store admin/user settings (language preferences, etc).
    
    Supports per-user settings for future multi-user support.
    Phase 1: all settings use user_id=1.
    """
    __tablename__ = 'settings'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, default=1)
    
    key = db.Column(db.String(100), nullable=False)
    value = db.Column(db.String(512))
    data_type = db.Column(db.String(20), default='string')  # 'string', 'json', 'bool', 'int'
    
    # Composite unique constraint (per user)
    __table_args__ = (
        db.UniqueConstraint('user_id', 'key', name='uq_user_setting'),
    )
    
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    @staticmethod
    def get(key, user_id=1, default=None):
        """Get a setting value by key (Phase 1 uses user_id=1)."""
        setting = Setting.query.filter_by(user_id=user_id, key=key).first()
        if setting:
            # Convert value to appropriate type
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
        """Set a setting value (Phase 1 uses user_id=1)."""
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
        """Serialize setting to dictionary."""
        return {
            'id': self.id,
            'key': self.key,
            'value': self.value,
            'data_type': self.data_type,
            'updated_at': self.updated_at.isoformat(),
        }


class ExportHistory(db.Model):
    """
    Track exports of meetings (PDF, email, etc).
    
    Phase 3: will support email exports.
    Phase 1: tracks PDF exports.
    """
    __tablename__ = 'export_history'
    
    id = db.Column(db.Integer, primary_key=True)
    meeting_id = db.Column(db.String(36), db.ForeignKey('meetings.id'), nullable=False)
    
    export_type = db.Column(db.String(50))  # 'pdf', 'email', 'file'
    recipient = db.Column(db.String(256))  # Email address or filepath
    status = db.Column(db.String(20))  # 'success', 'failed', 'pending'
    error_message = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        """Serialize export history to dictionary."""
        return {
            'id': self.id,
            'meeting_id': self.meeting_id,
            'export_type': self.export_type,
            'recipient': self.recipient,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
        }
