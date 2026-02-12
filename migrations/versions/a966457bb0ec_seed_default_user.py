"""seed default user

Revision ID: a966457bb0ec
Revises: 6f2974f6e7c4
Create Date: 2026-02-12 11:37:25.102162

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a966457bb0ec'
down_revision: Union[str, Sequence[str], None] = '6f2974f6e7c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        INSERT INTO users (id, username, email, created_at, updated_at)
        VALUES (1, 'default', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DELETE FROM users WHERE id = 1")
