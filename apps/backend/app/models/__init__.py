from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models so Alembic discovers them on Base.metadata
from app.models.child import Child  # noqa: F401
from app.models.error_question import ErrorQuestion  # noqa: F401
from app.models.graded_question import GradedQuestion  # noqa: F401
from app.models.parent import Parent  # noqa: F401
from app.models.submission import Submission  # noqa: F401
