import argparse
import subprocess
import sys
from pathlib import Path


def run_alembic_upgrade() -> None:
    root = Path(__file__).resolve().parent.parent
    alembic_ini = root / "alembic.ini"
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", str(alembic_ini), "upgrade", "head"],
        check=True,
    )


def run_seed(reset: bool) -> None:
    from tools.seed_defaults import seed_defaults
    from app import app

    with app.app_context():
        seed_defaults(reset=reset)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run migrations and seed defaults")
    parser.add_argument("--reset", action="store_true", help="Delete defaults before seeding")
    args = parser.parse_args()

    run_alembic_upgrade()
    run_seed(reset=args.reset)


if __name__ == "__main__":
    main()
