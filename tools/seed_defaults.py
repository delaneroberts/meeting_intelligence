import argparse
from datetime import datetime

from backend.models import db, User, Setting


def seed_defaults(reset: bool = False) -> None:
    if reset:
        Setting.query.filter_by(user_id=1).delete()
        User.query.filter_by(id=1).delete()
        db.session.commit()

    user = User.query.filter_by(id=1).first()
    if not user:
        user = User(id=1, username="default", email=None, created_at=datetime.utcnow())
        db.session.add(user)

    defaults = {
        "default_language": ("Cantonese", "string"),
        "summary_language": ("Cantonese", "string"),
        "auto_detect_qa": ("true", "bool"),
    }

    for key, (value, data_type) in defaults.items():
        existing = Setting.query.filter_by(user_id=1, key=key).first()
        if existing:
            existing.value = str(value)
            existing.data_type = data_type
        else:
            db.session.add(
                Setting(user_id=1, key=key, value=str(value), data_type=data_type)
            )

    db.session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed default user/settings")
    parser.add_argument("--reset", action="store_true", help="Delete defaults before seeding")
    args = parser.parse_args()

    from app import app

    with app.app_context():
        seed_defaults(reset=args.reset)


if __name__ == "__main__":
    main()
