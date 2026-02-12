"""set auto language defaults

Revision ID: 0b37d8ad60b5
Revises: f9f7c5b8f6c4
Create Date: 2026-02-12 11:57:22.734649

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0b37d8ad60b5'
down_revision: Union[str, Sequence[str], None] = 'f9f7c5b8f6c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        UPDATE settings
        SET value = 'auto', data_type = 'string'
        WHERE user_id = 1 AND key IN ('default_language', 'summary_language')
        """
    )
    op.execute(
        """
        INSERT INTO settings (user_id, key, value, data_type, updated_at)
        SELECT 1, 'default_language', 'auto', 'string', CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM settings WHERE user_id = 1 AND key = 'default_language'
        )
        """
    )
    op.execute(
        """
        INSERT INTO settings (user_id, key, value, data_type, updated_at)
        SELECT 1, 'summary_language', 'auto', 'string', CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
            SELECT 1 FROM settings WHERE user_id = 1 AND key = 'summary_language'
        )
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        UPDATE settings
        SET value = 'Cantonese', data_type = 'string'
        WHERE user_id = 1 AND key IN ('default_language', 'summary_language')
        """
    )
