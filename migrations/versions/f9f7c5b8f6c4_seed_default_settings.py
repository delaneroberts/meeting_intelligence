"""seed default settings

Revision ID: f9f7c5b8f6c4
Revises: a966457bb0ec
Create Date: 2026-02-12 11:38:55.707762

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f9f7c5b8f6c4'
down_revision: Union[str, Sequence[str], None] = 'a966457bb0ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        INSERT INTO settings (user_id, key, value, data_type, updated_at)
        VALUES
            (1, 'default_language', 'Cantonese', 'string', CURRENT_TIMESTAMP),
            (1, 'summary_language', 'Cantonese', 'string', CURRENT_TIMESTAMP),
            (1, 'auto_detect_qa', 'true', 'bool', CURRENT_TIMESTAMP)
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        DELETE FROM settings
        WHERE user_id = 1 AND key IN ('default_language', 'summary_language', 'auto_detect_qa')
        """
    )
