from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models so Alembic discovers them on Base.metadata
from app.models.child import Child  # noqa: F401
from app.models.parent import Parent  # noqa: F401
