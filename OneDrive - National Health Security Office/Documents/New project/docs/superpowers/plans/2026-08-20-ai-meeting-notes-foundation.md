# AI Meeting Notes Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the secure foundation for Google Sign-in, personal and organizational workspaces, membership approval, role-based authorization, and append-only audit logging.

**Architecture:** Create a new `ai-meeting-notes` monorepo folder. A FastAPI service owns identity, sessions, tenant authorization, and audit data in PostgreSQL; a React admin app uses cookie sessions with CSRF protection. Every protected query is scoped by organization and every privileged mutation records metadata-only audit events.

**Tech Stack:** Python 3.14.7, FastAPI 0.141.1, PostgreSQL 18.4, SQLAlchemy 2.x, Alembic, pytest, Node.js 24.19.0 LTS, React 19.2.7, TypeScript, Vite, Vitest, Testing Library, Docker Compose

**Spec:** `docs/superpowers/specs/2026-08-20-ai-meeting-notes-design.md`

**Version sources (checked 2026-08-20):** [Python 3.14.7](https://www.python.org/downloads/release/python-3147/), [FastAPI 0.141.1](https://pypi.org/project/fastapi/), [PostgreSQL 18.4](https://www.postgresql.org/docs/current/), [Node.js 24 LTS](https://nodejs.org/en/about/previous-releases), [React 19.2.7](https://react.dev/versions), [Vite 8.1](https://vite.dev/blog/announcing-vite8-1)

## Global Constraints

- All Google accounts may sign in; organization access requires an invitation or administrator approval.
- User roles are `owner`, `admin`, `reviewer`, and `member`; suspended memberships grant no access.
- Backend authorization is deny-by-default and verifies tenant plus object access on every protected request.
- Web authentication uses `Secure`, `HttpOnly`, `SameSite=Lax` session cookies in production and CSRF tokens for state-changing requests.
- Google ID tokens must validate signature, issuer, audience, expiration, and nonce where the client flow supplies one.
- Public resource identifiers are random UUIDs, never incrementing integers.
- Audit events contain actor, action, resource UUID, timestamp, and result; they must not contain meeting, transcript, chat, or audio content.
- Admin actions require application-verifiable MFA before production use; Phase 1 models the requirement and blocks admin endpoints unless `mfa_verified_at` is fresh.
- Production disables debug mode, auto-reload, public OpenAPI routes, permissive CORS, and detailed stack traces.
- No secret may appear in source, client bundles, logs, test fixtures, or committed environment files.
- Phase 1 must not implement recording, AI processing, exports, public sharing, or third-party analytics.

---

## Planned File Structure

```text
ai-meeting-notes/
├── .env.example                       # names and safe local defaults only
├── .gitignore
├── compose.yaml                       # local PostgreSQL and service health checks
├── README.md                          # local setup and verification commands
├── backend/
│   ├── pyproject.toml                 # pinned top-level dependencies and tools
│   ├── uv.lock
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   │       ├── 0001_identity_and_orgs.py
│   │       ├── 0002_totp_mfa.py
│   │       └── 0003_audit_append_only.py
│   ├── app/
│   │   ├── main.py                    # FastAPI factory and production controls
│   │   ├── config.py                  # validated environment settings
│   │   ├── db.py                      # async engine and session dependency
│   │   ├── api/
│   │   │   ├── deps.py                # current session and tenant guards
│   │   │   └── v1/
│   │   │       ├── auth.py
│   │   │       ├── mfa.py
│   │   │       ├── organizations.py
│   │   │       └── members.py
│   │   ├── models/
│   │   │   ├── base.py
│   │   │   ├── identity.py
│   │   │   ├── mfa.py
│   │   │   ├── organization.py
│   │   │   └── audit.py
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   └── organization.py
│   │   ├── security/
│   │   │   ├── google_tokens.py
│   │   │   ├── mfa.py
│   │   │   ├── sessions.py
│   │   │   └── csrf.py
│   │   └── services/
│   │       ├── organizations.py
│   │       └── audit.py
│   └── tests/
│       ├── conftest.py
│       ├── test_health.py
│       ├── test_google_auth.py
│       ├── test_mfa.py
│       ├── test_organization_authorization.py
│       ├── test_membership_workflow.py
│       ├── test_audit_log.py
│       └── test_security_contract.py
└── admin-web/
    ├── package.json
    ├── package-lock.json
    ├── vite.config.ts
    ├── vitest.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/client.ts
        ├── auth/AuthProvider.tsx
        ├── auth/GoogleSignInButton.tsx
        ├── pages/LoginPage.tsx
        ├── pages/MfaPage.tsx
        ├── pages/OrganizationsPage.tsx
        ├── pages/MembersPage.tsx
        └── test/
            ├── setup.ts
            ├── login.test.tsx
            ├── mfa.test.tsx
            └── members.test.tsx
```

---

### Task 1: Secure Project Shell and Health Contract

**Files:**
- Create: `ai-meeting-notes/.gitignore`
- Create: `ai-meeting-notes/.env.example`
- Create: `ai-meeting-notes/compose.yaml`
- Create: `ai-meeting-notes/backend/pyproject.toml`
- Create: `ai-meeting-notes/backend/app/main.py`
- Create: `ai-meeting-notes/backend/app/config.py`
- Create: `ai-meeting-notes/backend/tests/test_health.py`

**Interfaces:**
- Consumes: none
- Produces: `create_app(settings: Settings | None = None) -> FastAPI`, `Settings`, `GET /health/live`, and `GET /health/ready`

- [ ] **Step 1: Write the failing health and production-security tests**

```python
# backend/tests/test_health.py
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_liveness_is_public_and_minimal() -> None:
    client = TestClient(create_app(Settings(environment="test")))
    response = client.get("/health/live")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_production_disables_api_documentation() -> None:
    client = TestClient(create_app(Settings(environment="production")))
    assert client.get("/docs").status_code == 404
    assert client.get("/openapi.json").status_code == 404
```

- [ ] **Step 2: Run the tests and confirm the missing application fails**

Run: `cd ai-meeting-notes/backend && uv run pytest tests/test_health.py -v`

Expected: FAIL during import because `app.config` and `app.main` do not exist.

- [ ] **Step 3: Add the dependency manifest and validated settings**

```toml
# backend/pyproject.toml
[project]
name = "ai-meeting-notes-backend"
version = "0.1.0"
requires-python = ">=3.14,<3.15"
dependencies = [
  "fastapi==0.141.1",
  "uvicorn[standard]",
  "pydantic-settings",
]

[dependency-groups]
dev = ["httpx", "pytest", "pytest-asyncio", "ruff"]

[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]

[tool.ruff]
line-length = 100
```

```python
# backend/app/config.py
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+asyncpg://meeting:meeting@localhost:5432/meeting"
    allowed_hosts: list[str] = Field(default_factory=lambda: ["localhost", "testserver"])
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Implement the application factory with secure production defaults**

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from app.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    cfg = settings or get_settings()
    production = cfg.environment == "production"
    app = FastAPI(
        title="AI Meeting Notes API",
        debug=False,
        docs_url=None if production else "/docs",
        redoc_url=None,
        openapi_url=None if production else "/openapi.json",
    )
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=cfg.allowed_hosts)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "X-CSRF-Token"],
    )

    @app.get("/health/live")
    async def live() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/health/ready")
    async def ready() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
```

- [ ] **Step 5: Add safe local configuration files**

```dotenv
# .env.example
ENVIRONMENT=development
DATABASE_URL=postgresql+asyncpg://meeting:meeting@localhost:5432/meeting
GOOGLE_WEB_CLIENT_ID=
MFA_ENCRYPTION_KEY=
```

```gitignore
# .gitignore
.env
.venv/
__pycache__/
.pytest_cache/
.ruff_cache/
node_modules/
dist/
*.log
```

```yaml
# compose.yaml
services:
  postgres:
    image: postgres:18.4
    environment:
      POSTGRES_DB: meeting
      POSTGRES_USER: meeting
      POSTGRES_PASSWORD: meeting
    ports: ["5432:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U meeting -d meeting"]
      interval: 5s
      timeout: 3s
      retries: 10
    volumes:
      - meeting_pgdata:/var/lib/postgresql/data

volumes:
  meeting_pgdata:
```

- [ ] **Step 6: Lock dependencies and run verification**

Run: `cd ai-meeting-notes/backend && uv lock && uv run pytest tests/test_health.py -v && uv run ruff check .`

Expected: 2 tests PASS and Ruff exits 0.

- [ ] **Step 7: Commit the secure shell**

```bash
git add ai-meeting-notes/.gitignore ai-meeting-notes/.env.example ai-meeting-notes/compose.yaml ai-meeting-notes/backend
git commit -m "feat: add secure meeting notes service shell"
```

---

### Task 2: PostgreSQL Identity and Organization Model

**Files:**
- Create: `ai-meeting-notes/backend/app/db.py`
- Create: `ai-meeting-notes/backend/app/models/base.py`
- Create: `ai-meeting-notes/backend/app/models/identity.py`
- Create: `ai-meeting-notes/backend/app/models/organization.py`
- Create: `ai-meeting-notes/backend/alembic.ini`
- Create: `ai-meeting-notes/backend/alembic/env.py`
- Create: `ai-meeting-notes/backend/alembic/versions/0001_identity_and_orgs.py`
- Create: `ai-meeting-notes/backend/tests/conftest.py`
- Create: `ai-meeting-notes/backend/tests/test_identity_models.py`
- Modify: `ai-meeting-notes/backend/pyproject.toml`

**Interfaces:**
- Consumes: `Settings.database_url`
- Produces: `get_db() -> AsyncIterator[AsyncSession]`, `User`, `Session`, `Organization`, `Membership`, `Invitation`, and `MembershipRequest`

- [ ] **Step 1: Write failing persistence tests for personal workspace and unique Google identity**

```python
# backend/tests/test_identity_models.py
import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models.identity import User
from app.models.organization import MembershipRole, OrganizationKind
from app.services.organizations import create_user_with_personal_workspace


@pytest.mark.asyncio
async def test_new_user_gets_one_personal_workspace(db_session):
    user = await create_user_with_personal_workspace(
        db_session, google_subject="google-123", email="user@example.com", display_name="ผู้ใช้"
    )
    assert user.google_subject == "google-123"
    assert len(user.memberships) == 1
    membership = user.memberships[0]
    assert membership.role == MembershipRole.OWNER
    assert membership.organization.kind == OrganizationKind.PERSONAL


@pytest.mark.asyncio
async def test_google_subject_is_unique(db_session):
    db_session.add_all([
        User(google_subject="same", email="one@example.com", display_name="One"),
        User(google_subject="same", email="two@example.com", display_name="Two"),
    ])
    with pytest.raises(IntegrityError):
        await db_session.commit()
```

- [ ] **Step 2: Run the model tests and verify they fail**

Run: `cd ai-meeting-notes/backend && uv run pytest tests/test_identity_models.py -v`

Expected: FAIL because the database models and organization service are missing.

- [ ] **Step 3: Add database dependencies and async session factory**

Run: `cd ai-meeting-notes/backend && uv add sqlalchemy asyncpg alembic`

```python
# backend/app/db.py
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings

engine = create_async_engine(get_settings().database_url, pool_pre_ping=True)
SessionFactory = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionFactory() as session:
        yield session
```

- [ ] **Step 4: Implement UUID base and identity models**

```python
# backend/app/models/base.py
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Uuid, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDTimestampMixin:
    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
```

```python
# backend/app/models/identity.py
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDTimestampMixin


class User(UUIDTimestampMixin, Base):
    __tablename__ = "users"
    google_subject: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    memberships: Mapped[list["Membership"]] = relationship(back_populates="user", lazy="selectin")


class Session(UUIDTimestampMixin, Base):
    __tablename__ = "sessions"
    __table_args__ = (UniqueConstraint("token_hash"),)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    client_type: Mapped[str] = mapped_column(String(16), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    mfa_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
```

- [ ] **Step 5: Implement organization and membership models**

```python
# backend/app/models/organization.py
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDTimestampMixin


class OrganizationKind(str, enum.Enum):
    PERSONAL = "personal"
    ORGANIZATION = "organization"


class MembershipRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    REVIEWER = "reviewer"
    MEMBER = "member"


class MembershipStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    SUSPENDED = "suspended"


class MembershipRequestStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Organization(UUIDTimestampMixin, Base):
    __tablename__ = "organizations"
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    kind: Mapped[OrganizationKind] = mapped_column(Enum(OrganizationKind), nullable=False)
    memberships: Mapped[list["Membership"]] = relationship(back_populates="organization")


class Membership(UUIDTimestampMixin, Base):
    __tablename__ = "memberships"
    __table_args__ = (UniqueConstraint("organization_id", "user_id"),)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[MembershipRole] = mapped_column(Enum(MembershipRole), nullable=False)
    status: Mapped[MembershipStatus] = mapped_column(Enum(MembershipStatus), nullable=False)
    organization: Mapped[Organization] = relationship(back_populates="memberships", lazy="selectin")
    user: Mapped["User"] = relationship(back_populates="memberships", lazy="selectin")


class Invitation(UUIDTimestampMixin, Base):
    __tablename__ = "invitations"
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    role: Mapped[MembershipRole] = mapped_column(Enum(MembershipRole), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MembershipRequest(UUIDTimestampMixin, Base):
    __tablename__ = "membership_requests"
    __table_args__ = (UniqueConstraint("organization_id", "user_id"),)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[MembershipRequestStatus] = mapped_column(
        Enum(MembershipRequestStatus), nullable=False
    )
```

- [ ] **Step 6: Implement atomic personal-workspace creation**

```python
# backend/app/services/organizations.py
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.identity import User
from app.models.organization import (
    Membership, MembershipRole, MembershipStatus, Organization, OrganizationKind,
)


async def create_user_with_personal_workspace(
    db: AsyncSession, *, google_subject: str, email: str, display_name: str
) -> User:
    user = User(google_subject=google_subject, email=email.lower(), display_name=display_name)
    organization = Organization(name=f"พื้นที่ของ {display_name}", kind=OrganizationKind.PERSONAL)
    membership = Membership(
        user=user,
        organization=organization,
        role=MembershipRole.OWNER,
        status=MembershipStatus.ACTIVE,
    )
    db.add_all([user, organization, membership])
    await db.commit()
    await db.refresh(user, attribute_names=["memberships"])
    return user
```

- [ ] **Step 7: Add migration and PostgreSQL-backed test fixture**

Create `0001_identity_and_orgs.py` with the exact tables, UUID primary keys, foreign keys, enum values, unique constraints, and indexes defined above. Configure `tests/conftest.py` to read `TEST_DATABASE_URL`, apply `alembic upgrade head` once per test session, and wrap each test in a transaction that rolls back.

```python
# tests/conftest.py — core fixture contract
@pytest_asyncio.fixture
async def db_session() -> AsyncIterator[AsyncSession]:
    async with TestSessionFactory() as session:
        transaction = await session.begin()
        try:
            yield session
        finally:
            await transaction.rollback()
```

- [ ] **Step 8: Run migration and model verification**

Run: `docker compose up -d postgres && cd backend && uv run alembic upgrade head && uv run pytest tests/test_identity_models.py -v`

Expected: migration exits 0 and both model tests PASS.

- [ ] **Step 9: Commit the identity schema**

```bash
git add ai-meeting-notes/backend
git commit -m "feat: add identity and organization data model"
```

---

### Task 3: Google Token Verification and Opaque Sessions

**Files:**
- Create: `ai-meeting-notes/backend/app/security/google_tokens.py`
- Create: `ai-meeting-notes/backend/app/security/sessions.py`
- Create: `ai-meeting-notes/backend/app/schemas/auth.py`
- Create: `ai-meeting-notes/backend/app/api/v1/auth.py`
- Create: `ai-meeting-notes/backend/tests/test_google_auth.py`
- Modify: `ai-meeting-notes/backend/app/config.py`
- Modify: `ai-meeting-notes/backend/app/main.py`
- Modify: `ai-meeting-notes/backend/pyproject.toml`

**Interfaces:**
- Consumes: `User`, `Session`, `create_user_with_personal_workspace()`
- Produces: `GoogleClaims`, `verify_google_id_token(token: str, expected_nonce: str) -> GoogleClaims`, `create_session(db, user_id, client_type) -> tuple[Session, str]`, `authenticate_session(db, raw_token) -> Session`, `GET /v1/auth/google/nonce`, `POST /v1/auth/google`, `POST /v1/auth/logout`, `GET /v1/auth/me`

- [ ] **Step 1: Write failing verifier and login tests with a fake verifier**

```python
# backend/tests/test_google_auth.py
from app.security.google_tokens import GoogleClaims


def test_google_login_creates_personal_workspace(client, fake_google_verifier):
    fake_google_verifier.claims = GoogleClaims(
        subject="g-1", email="person@gmail.com", email_verified=True, name="บุคคลทดสอบ"
    )
    response = client.post(
        "/v1/auth/google",
        json={"id_token": "signed-by-google", "client_type": "web", "nonce": "login-nonce"},
    )
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "person@gmail.com"
    assert response.json()["organizations"][0]["kind"] == "personal"
    assert "am_session=" in response.headers["set-cookie"]
    assert "HttpOnly" in response.headers["set-cookie"]


def test_unverified_email_is_rejected(client, fake_google_verifier):
    fake_google_verifier.claims = GoogleClaims(
        subject="g-2", email="bad@gmail.com", email_verified=False, name="Bad"
    )
    response = client.post(
        "/v1/auth/google", json={"id_token": "x", "client_type": "web", "nonce": "login-nonce"}
    )
    assert response.status_code == 401


def test_nonce_mismatch_is_rejected(client, fake_google_verifier):
    response = client.post(
        "/v1/auth/google",
        json={"id_token": "signed-for-other-nonce", "client_type": "web", "nonce": "expected"},
    )
    assert response.status_code == 401
```

- [ ] **Step 2: Run the auth tests and verify they fail**

Run: `cd ai-meeting-notes/backend && uv run pytest tests/test_google_auth.py -v`

Expected: FAIL because `GoogleClaims` and the auth router do not exist.

- [ ] **Step 3: Add Google verification dependency and settings**

Run: `cd ai-meeting-notes/backend && uv add google-auth email-validator`

```python
# additions to backend/app/config.py
google_web_client_id: str = ""
session_ttl_hours: int = 12
session_cookie_secure: bool = False
```

```python
# backend/app/security/google_tokens.py
from dataclasses import dataclass

from google.auth.transport import requests
from google.oauth2 import id_token

from app.config import get_settings


@dataclass(frozen=True)
class GoogleClaims:
    subject: str
    email: str
    email_verified: bool
    name: str


def verify_google_id_token(token: str, expected_nonce: str) -> GoogleClaims:
    cfg = get_settings()
    payload = id_token.verify_oauth2_token(token, requests.Request(), cfg.google_web_client_id)
    if payload.get("iss") not in {"accounts.google.com", "https://accounts.google.com"}:
        raise ValueError("invalid issuer")
    if payload.get("nonce") != expected_nonce:
        raise ValueError("invalid nonce")
    if not payload.get("email_verified", False):
        raise ValueError("email is not verified")
    return GoogleClaims(
        subject=payload["sub"],
        email=payload["email"].lower(),
        email_verified=True,
        name=payload.get("name") or payload["email"],
    )
```

- [ ] **Step 4: Implement hashed opaque session tokens**

```python
# backend/app/security/sessions.py
import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.identity import Session


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


async def create_session(
    db: AsyncSession, user_id: uuid.UUID, client_type: str
) -> tuple[Session, str]:
    raw_token = secrets.token_urlsafe(32)
    session = Session(
        user_id=user_id,
        token_hash=hash_token(raw_token),
        client_type=client_type,
        expires_at=datetime.now(UTC) + timedelta(hours=get_settings().session_ttl_hours),
    )
    db.add(session)
    await db.commit()
    return session, raw_token


async def authenticate_session(db: AsyncSession, raw_token: str) -> Session | None:
    statement = select(Session).where(
        Session.token_hash == hash_token(raw_token),
        Session.revoked_at.is_(None),
        Session.expires_at > datetime.now(UTC),
    )
    return await db.scalar(statement)
```

- [ ] **Step 5: Implement auth request/response schemas and endpoints**

```python
# backend/app/schemas/auth.py
from typing import Literal
from pydantic import BaseModel, EmailStr, Field


class GoogleLoginRequest(BaseModel):
    id_token: str = Field(min_length=20, max_length=8192)
    client_type: Literal["web", "android"]
    nonce: str = Field(min_length=32, max_length=128)


class UserView(BaseModel):
    id: str
    email: EmailStr
    display_name: str


class AuthResponse(BaseModel):
    user: UserView
    organizations: list[dict[str, str]]
    access_token: str | None = None
```

Implement `POST /v1/auth/google` so it:

1. compares the submitted nonce with a short-lived `am_login_nonce` cookie for web, then verifies the same nonce claim inside the Google token;
2. loads by `google_subject` or creates the user plus personal workspace atomically;
3. updates display name and normalized email on later sign-ins;
4. creates an opaque session;
5. sets `am_session` as HttpOnly, SameSite=Lax, Path=/ for web;
6. returns the raw token only when `client_type == "android"`;
7. returns dedicated response models, never ORM objects.

Implement `GET /v1/auth/google/nonce` to generate 32 random bytes, return the URL-safe nonce, and set the same value in an HttpOnly, SameSite=Lax cookie that expires after 5 minutes. Clear that cookie after either successful or failed login. Android Phase 2 generates a cryptographically random, single-use nonce in memory and supplies it through the same request field.

Implement logout by revoking the current session and clearing the cookie. Implement `/me` from the authenticated session.

- [ ] **Step 6: Register the router and run authentication tests**

```python
# addition in app/main.py
from app.api.v1.auth import router as auth_router
app.include_router(auth_router, prefix="/v1/auth", tags=["auth"])
```

Run: `cd ai-meeting-notes/backend && uv run pytest tests/test_google_auth.py -v`

Expected: login, unverified-email, logout, expired-session, wrong-audience, and duplicate-login tests PASS.

- [ ] **Step 7: Commit Google authentication**

```bash
git add ai-meeting-notes/backend
git commit -m "feat: add verified Google login and opaque sessions"
```

---

### Task 4: Tenant Guards and Organization Management

**Files:**
- Create: `ai-meeting-notes/backend/app/api/deps.py`
- Create: `ai-meeting-notes/backend/app/schemas/organization.py`
- Create: `ai-meeting-notes/backend/app/api/v1/organizations.py`
- Create: `ai-meeting-notes/backend/tests/test_organization_authorization.py`
- Modify: `ai-meeting-notes/backend/app/services/organizations.py`
- Modify: `ai-meeting-notes/backend/app/main.py`

**Interfaces:**
- Consumes: `authenticate_session()`, `Organization`, `Membership`
- Produces: `CurrentUser`, `OrganizationAccess`, `require_roles(*roles)`, `GET/POST /v1/organizations`, and `GET /v1/organizations/{organization_id}`

- [ ] **Step 1: Write failing tenant-isolation tests**

```python
# backend/tests/test_organization_authorization.py
def test_member_cannot_read_another_organization(client, auth_as, org_factory):
    alice, alice_org = org_factory("alice@example.com")
    _, bob_org = org_factory("bob@example.com")
    auth_as(alice)
    response = client.get(f"/v1/organizations/{bob_org.id}")
    assert response.status_code == 404


def test_suspended_member_has_no_access(client, auth_as, membership_factory):
    user, organization = membership_factory(status="suspended")
    auth_as(user)
    response = client.get(f"/v1/organizations/{organization.id}")
    assert response.status_code == 404
```

- [ ] **Step 2: Run tenant tests and verify failure**

Run: `cd ai-meeting-notes/backend && uv run pytest tests/test_organization_authorization.py -v`

Expected: FAIL because tenant dependencies and endpoints are missing.

- [ ] **Step 3: Implement current-user and organization-access dependencies**

```python
# backend/app/api/deps.py
from dataclasses import dataclass
import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.identity import Session, User
from app.models.organization import Membership, MembershipRole, MembershipStatus, Organization
from app.security.sessions import authenticate_session


@dataclass(frozen=True)
class CurrentUser:
    user: User
    session: Session


@dataclass(frozen=True)
class OrganizationAccess:
    organization: Organization
    membership: Membership


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> CurrentUser:
    raw_token = request.cookies.get("am_session")
    if not raw_token and request.headers.get("Authorization", "").startswith("Bearer "):
        raw_token = request.headers["Authorization"][7:]
    session = await authenticate_session(db, raw_token or "")
    if session is None:
        raise HTTPException(status_code=401, detail="authentication required")
    user = await db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=401, detail="authentication required")
    return CurrentUser(user=user, session=session)


async def get_organization_access(
    organization_id: uuid.UUID,
    current: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrganizationAccess:
    membership = await db.scalar(
        select(Membership).where(
            Membership.organization_id == organization_id,
            Membership.user_id == current.user.id,
            Membership.status == MembershipStatus.ACTIVE,
        )
    )
    if membership is None:
        raise HTTPException(status_code=404, detail="organization not found")
    organization = await db.get(Organization, organization_id)
    return OrganizationAccess(organization=organization, membership=membership)
```

- [ ] **Step 4: Add role guard and organization endpoints**

```python
# role guard contract in app/api/deps.py
def require_roles(*allowed: MembershipRole):
    async def guard(access: OrganizationAccess = Depends(get_organization_access)) -> OrganizationAccess:
        if access.membership.role not in allowed:
            raise HTTPException(status_code=403, detail="insufficient role")
        return access
    return guard
```

Implement organization creation with normalized name length 2–255, organization kind fixed to `organization`, caller membership fixed to active owner, and one database transaction. List only active memberships. Return response schemas containing `id`, `name`, `kind`, `role`, and `status`.

- [ ] **Step 5: Run authorization tests and full backend suite**

Run: `cd ai-meeting-notes/backend && uv run pytest tests/test_organization_authorization.py -v && uv run pytest -q`

Expected: all tenant tests and the full suite PASS.

- [ ] **Step 6: Commit tenant authorization**

```bash
git add ai-meeting-notes/backend
git commit -m "feat: enforce organization tenant boundaries"
```

---

### Task 5: Invitation, Membership Request, Approval, and Suspension

**Files:**
- Create: `ai-meeting-notes/backend/app/api/v1/members.py`
- Create: `ai-meeting-notes/backend/tests/test_membership_workflow.py`
- Modify: `ai-meeting-notes/backend/app/services/organizations.py`
- Modify: `ai-meeting-notes/backend/app/schemas/organization.py`
- Modify: `ai-meeting-notes/backend/app/main.py`

**Interfaces:**
- Consumes: `require_roles()`, `Invitation`, `MembershipRequest`, `Membership`
- Produces: `create_invitation() -> str`, `accept_invitation() -> Membership`, `request_membership()`, `approve_membership()`, and member-management API routes

- [ ] **Step 1: Write failing workflow tests**

```python
# backend/tests/test_membership_workflow.py
def test_invitation_is_email_bound_and_one_time(client, auth_as, organization_factory):
    admin, organization = organization_factory(role="admin")
    auth_as(admin)
    created = client.post(
        f"/v1/organizations/{organization.id}/invitations",
        json={"email": "invitee@gmail.com", "role": "member"},
        headers={"X-CSRF-Token": "valid-test-token"},
    )
    assert created.status_code == 201
    code = created.json()["invitation_code"]

    invitee = auth_as("invitee@gmail.com")
    assert client.post("/v1/memberships/accept-invitation", json={"code": code}).status_code == 200
    assert client.post("/v1/memberships/accept-invitation", json={"code": code}).status_code == 409


def test_member_cannot_promote_self(client, auth_as, membership_factory):
    member, organization = membership_factory(role="member")
    auth_as(member)
    response = client.patch(
        f"/v1/organizations/{organization.id}/members/{member.id}",
        json={"role": "admin"},
        headers={"X-CSRF-Token": "valid-test-token"},
    )
    assert response.status_code == 403
```

- [ ] **Step 2: Run workflow tests and verify failure**

Run: `cd ai-meeting-notes/backend && uv run pytest tests/test_membership_workflow.py -v`

Expected: FAIL because the member workflow routes are missing.

- [ ] **Step 3: Implement invitation-code hashing and acceptance**

```python
# additions to app/services/organizations.py
import hashlib
import secrets
from datetime import UTC, datetime, timedelta


def _hash_invitation(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


async def create_invitation(db, *, organization_id, email, role) -> tuple[Invitation, str]:
    code = secrets.token_urlsafe(24)
    invitation = Invitation(
        organization_id=organization_id,
        email=email.strip().lower(),
        token_hash=_hash_invitation(code),
        role=role,
        expires_at=datetime.now(UTC) + timedelta(days=7),
    )
    db.add(invitation)
    await db.commit()
    return invitation, code
```

Acceptance must lock the invitation row, compare normalized signed-in email, reject expired/accepted codes, upsert one membership, mark invitation accepted, and commit atomically.

- [ ] **Step 4: Implement request, approval, role-change, and suspension rules**

Rules enforced in the service and tested through the API:

- any signed-in user may request membership once;
- owner/admin may approve or reject requests;
- only owner may assign `owner` or change another owner;
- admin may assign `admin`, `reviewer`, or `member` but may not elevate self;
- owner/admin may suspend non-owner members;
- an organization must retain at least one active owner;
- all endpoints use `SELECT ... FOR UPDATE` for membership mutations.

- [ ] **Step 5: Add API schemas and routes**

Implement:

```text
POST   /v1/organizations/{org_id}/invitations
POST   /v1/memberships/accept-invitation
POST   /v1/organizations/{org_id}/membership-requests
GET    /v1/organizations/{org_id}/membership-requests
PATCH  /v1/organizations/{org_id}/membership-requests/{request_id}
GET    /v1/organizations/{org_id}/members
PATCH  /v1/organizations/{org_id}/members/{user_id}
```

Use explicit Pydantic models with `extra="forbid"`; never accept organization ID, actor ID, or status from fields that the server derives.

- [ ] **Step 6: Run workflow and authorization tests**

Run: `cd ai-meeting-notes/backend && uv run pytest tests/test_membership_workflow.py tests/test_organization_authorization.py -v`

Expected: all invitation, approval, role, suspension, replay, and cross-tenant cases PASS.

- [ ] **Step 7: Commit membership workflows**

```bash
git add ai-meeting-notes/backend
git commit -m "feat: add controlled organization membership workflows"
```

---

### Task 6: CSRF Enforcement, TOTP MFA, and Append-only Audit Log

**Files:**
- Create: `ai-meeting-notes/backend/app/security/csrf.py`
- Create: `ai-meeting-notes/backend/app/security/mfa.py`
- Create: `ai-meeting-notes/backend/app/models/mfa.py`
- Create: `ai-meeting-notes/backend/app/api/v1/mfa.py`
- Create: `ai-meeting-notes/backend/app/models/audit.py`
- Create: `ai-meeting-notes/backend/app/services/audit.py`
- Create: `ai-meeting-notes/backend/alembic/versions/0002_totp_mfa.py`
- Create: `ai-meeting-notes/backend/alembic/versions/0003_audit_append_only.py`
- Create: `ai-meeting-notes/backend/tests/test_mfa.py`
- Create: `ai-meeting-notes/backend/tests/test_audit_log.py`
- Modify: `ai-meeting-notes/backend/app/config.py`
- Modify: `ai-meeting-notes/backend/app/models/identity.py`
- Modify: `ai-meeting-notes/backend/app/api/deps.py`
- Modify: `ai-meeting-notes/backend/app/api/v1/auth.py`
- Modify: `ai-meeting-notes/backend/app/api/v1/organizations.py`
- Modify: `ai-meeting-notes/backend/app/api/v1/members.py`

**Interfaces:**
- Consumes: `CurrentUser`, `Session`, and all privileged mutation routes
- Produces: `require_csrf()`, TOTP setup/confirm/verify endpoints, `require_recent_mfa()`, `record_audit_event()`, and append-only `audit_events`

- [ ] **Step 1: Write failing CSRF, MFA, and immutability tests**

```python
# backend/tests/test_mfa.py
import pyotp


def test_confirmed_totp_allows_admin_action(client, auth_as, pending_totp, organization_factory):
    admin, organization = organization_factory(role="admin")
    auth_as(admin, mfa_verified_at=None)
    secret = pending_totp(admin)
    response = client.post(
        "/v1/auth/mfa/totp/confirm",
        json={"code": pyotp.TOTP(secret).now()},
        headers={"X-CSRF-Token": "valid-test-token"},
    )
    assert response.status_code == 204
    assert client.get(f"/v1/organizations/{organization.id}/membership-requests").status_code == 200


def test_five_bad_totp_codes_lock_session(client, auth_as, confirmed_totp):
    user = auth_as("admin@gmail.com", mfa_verified_at=None)
    confirmed_totp(user)
    for _ in range(5):
        response = client.post(
            "/v1/auth/mfa/totp/verify",
            json={"code": "000000"},
            headers={"X-CSRF-Token": "valid-test-token"},
        )
    assert response.status_code == 429
```

```python
# backend/tests/test_audit_log.py
def test_cookie_authenticated_mutation_requires_csrf(client, auth_as, organization_factory):
    admin, organization = organization_factory(role="admin")
    auth_as(admin, client_type="web")
    response = client.post(
        f"/v1/organizations/{organization.id}/invitations",
        json={"email": "x@gmail.com", "role": "member"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_audit_row_cannot_be_updated(db_session, audit_event):
    audit_event.action = "tampered"
    with pytest.raises(DBAPIError):
        await db_session.commit()
```

- [ ] **Step 2: Run security workflow tests and verify failure**

Run: `cd ai-meeting-notes/backend && uv run pytest tests/test_mfa.py tests/test_audit_log.py -v`

Expected: FAIL because CSRF, TOTP MFA, and audit protections are absent.

- [ ] **Step 3: Implement CSRF double-submit verification**

```python
# backend/app/security/csrf.py
import hmac
from fastapi import HTTPException, Request


async def require_csrf(request: Request) -> None:
    if request.method in {"GET", "HEAD", "OPTIONS"}:
        return
    if request.headers.get("Authorization", "").startswith("Bearer "):
        return
    cookie = request.cookies.get("am_csrf", "")
    header = request.headers.get("X-CSRF-Token", "")
    if not cookie or not header or not hmac.compare_digest(cookie, header):
        raise HTTPException(status_code=403, detail="csrf validation failed")
```

At web login, generate a random CSRF token, set it in a readable `am_csrf` cookie with SameSite=Lax and Secure in production, and return the same value only through the cookie. The React client reads that cookie and sends `X-CSRF-Token` on mutations.

- [ ] **Step 4: Implement encrypted TOTP enrollment and verification**

Run: `cd ai-meeting-notes/backend && uv add pyotp cryptography`

Add `mfa_encryption_key: str` to `Settings`. Production startup fails if it is empty. Generate the deployment key with `uv run python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` and store it in the deployment secret manager, never Git.

Update production-settings tests to pass a fixed test-only Fernet key. Add `mfa_failed_attempts: int` and `mfa_locked_until: datetime | None` to the `Session` ORM model so it matches migration `0002_totp_mfa.py`.

```python
# backend/app/models/mfa.py
import uuid
from datetime import datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, LargeBinary, String
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDTimestampMixin


class MfaMethod(UUIDTimestampMixin, Base):
    __tablename__ = "mfa_methods"
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    method_type: Mapped[str] = mapped_column(String(16), default="totp", nullable=False)
    encrypted_secret: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
```

```python
# backend/app/security/mfa.py
from cryptography.fernet import Fernet
import pyotp
from app.config import get_settings


def encrypt_totp_secret(secret: str) -> bytes:
    return Fernet(get_settings().mfa_encryption_key.encode()).encrypt(secret.encode())


def decrypt_totp_secret(ciphertext: bytes) -> str:
    return Fernet(get_settings().mfa_encryption_key.encode()).decrypt(ciphertext).decode()


def verify_totp(secret: str, code: str) -> bool:
    return pyotp.TOTP(secret).verify(code, valid_window=1)
```

Migration `0002_totp_mfa.py` creates `mfa_methods` and adds `mfa_failed_attempts` (integer, default 0) plus `mfa_locked_until` (nullable timestamp) to `sessions`.

Implement CSRF-protected endpoints:

```text
POST /v1/auth/mfa/totp/setup    -> { secret, otpauth_uri }
POST /v1/auth/mfa/totp/confirm  -> 204
POST /v1/auth/mfa/totp/verify   -> 204
```

Setup requires a session created within 15 minutes and replaces only an unconfirmed method. Confirm and verify accept exactly six numeric digits. Five failed codes lock that session for 15 minutes and return 429. Success resets the counter and sets `mfa_verified_at`. Never log the secret, URI, or submitted code.

- [ ] **Step 5: Implement recent-MFA guard**

```python
# addition to app/api/deps.py
from datetime import UTC, datetime, timedelta


async def require_recent_mfa(current: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    verified = current.session.mfa_verified_at
    if verified is None or verified < datetime.now(UTC) - timedelta(minutes=15):
        raise HTTPException(status_code=403, detail="recent MFA required")
    return current
```

Apply this guard to invitation creation, membership request review, role changes, suspension, audit-log viewing, and incident administration. Normal member reads do not require MFA.

- [ ] **Step 6: Implement metadata-only audit model and writer**

```python
# backend/app/models/audit.py
import uuid
from sqlalchemy import ForeignKey, JSON, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, UUIDTimestampMixin


class AuditEvent(UUIDTimestampMixin, Base):
    __tablename__ = "audit_events"
    organization_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(80), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(40), nullable=False)
    resource_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    result: Mapped[str] = mapped_column(String(16), nullable=False)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
```

```python
# backend/app/services/audit.py
async def record_audit_event(
    db, *, organization_id, actor_user_id, action, resource_type, resource_id, result, metadata
) -> None:
    forbidden = {"audio", "transcript", "summary", "chat", "content", "text"}
    if forbidden.intersection(metadata):
        raise ValueError("audit metadata contains forbidden content fields")
    db.add(AuditEvent(
        organization_id=organization_id,
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        result=result,
        metadata_json=metadata,
    ))
```

- [ ] **Step 7: Add PostgreSQL audit immutability trigger**

Migration `0003_audit_append_only.py` creates `audit_events`, then installs a trigger function that raises for UPDATE or DELETE. The downgrade removes the trigger and table. Add a migration test that attempts both operations using raw SQL and expects failure.

- [ ] **Step 8: Add audit writes to every privileged mutation**

Record success and denied attempts for organization creation, invitation creation, request approval/rejection, role changes, suspension, MFA enrollment/verification/lockout, logout, and failed cross-tenant access. Metadata may include role before/after and request UUID, but never emails, invitation codes, tokens, MFA secrets/codes, or meeting content.

- [ ] **Step 9: Run MFA, security, and audit tests**

Run: `cd ai-meeting-notes/backend && uv run alembic upgrade head && uv run pytest tests/test_mfa.py tests/test_audit_log.py tests/test_security_contract.py -v`

Expected: TOTP enrollment, confirmation, verification, lockout, CSRF, recent-MFA, metadata rejection, append-only trigger, and audit-write tests PASS.

- [ ] **Step 10: Commit enforced security controls**

```bash
git add ai-meeting-notes/backend
git commit -m "feat: enforce csrf totp mfa and append-only audit"
```

---

### Task 7: React Admin Sign-in and Member Management

**Files:**
- Create: `ai-meeting-notes/admin-web/package.json`
- Create: `ai-meeting-notes/admin-web/package-lock.json`
- Create: `ai-meeting-notes/admin-web/vite.config.ts`
- Create: `ai-meeting-notes/admin-web/vitest.config.ts`
- Create: `ai-meeting-notes/admin-web/src/main.tsx`
- Create: `ai-meeting-notes/admin-web/src/App.tsx`
- Create: `ai-meeting-notes/admin-web/src/api/client.ts`
- Create: `ai-meeting-notes/admin-web/src/auth/AuthProvider.tsx`
- Create: `ai-meeting-notes/admin-web/src/auth/GoogleSignInButton.tsx`
- Create: `ai-meeting-notes/admin-web/src/pages/LoginPage.tsx`
- Create: `ai-meeting-notes/admin-web/src/pages/MfaPage.tsx`
- Create: `ai-meeting-notes/admin-web/src/pages/OrganizationsPage.tsx`
- Create: `ai-meeting-notes/admin-web/src/pages/MembersPage.tsx`
- Create: `ai-meeting-notes/admin-web/src/test/setup.ts`
- Create: `ai-meeting-notes/admin-web/src/test/login.test.tsx`
- Create: `ai-meeting-notes/admin-web/src/test/mfa.test.tsx`
- Create: `ai-meeting-notes/admin-web/src/test/members.test.tsx`

**Interfaces:**
- Consumes: `/v1/auth/google`, `/v1/auth/me`, TOTP MFA, organization, and membership endpoints
- Produces: Google login UI, MFA enrollment/verification, organization chooser, member list, invitation form, request approval, role change, and suspension UI

- [ ] **Step 1: Scaffold pinned React application and test tooling**

Run:

```bash
cd ai-meeting-notes
npm create vite@8.1.0 admin-web -- --template react-ts
cd admin-web
npm install react@19.2.7 react-dom@19.2.7 @react-oauth/google qrcode.react
npm install -D vitest jsdom msw @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Commit `package-lock.json`; CI and future tasks must use `npm ci`.

- [ ] **Step 2: Write failing login and members tests**

```tsx
// admin-web/src/test/login.test.tsx
it("shows Google sign-in when no session exists", async () => {
  server.use(http.get("/v1/auth/me", () => HttpResponse.json({}, { status: 401 })));
  render(<App />);
  expect(await screen.findByRole("button", { name: "เข้าสู่ระบบด้วย Google" })).toBeVisible();
});
```

```tsx
// admin-web/src/test/members.test.tsx
it("sends CSRF token when approving a member", async () => {
  document.cookie = "am_csrf=test-csrf; path=/";
  const captured: string[] = [];
  server.use(http.patch("/v1/organizations/:orgId/membership-requests/:id", ({ request }) => {
    captured.push(request.headers.get("X-CSRF-Token") ?? "");
    return HttpResponse.json({ status: "active" });
  }));
  render(<MembersPage organizationId="org-1" />);
  await userEvent.click(await screen.findByRole("button", { name: "อนุมัติสมาชิก" }));
expect(captured).toEqual(["test-csrf"]);
});
```

```tsx
// admin-web/src/test/mfa.test.tsx
it("confirms TOTP before opening administrator actions", async () => {
  render(<MfaPage />);
  await userEvent.type(screen.getByLabelText("รหัส 6 หลัก"), "123456");
  await userEvent.click(screen.getByRole("button", { name: "ยืนยัน MFA" }));
  expect(await screen.findByText("ยืนยัน MFA สำเร็จ")).toBeVisible();
});
```

- [ ] **Step 3: Run frontend tests and verify failure**

Run: `cd ai-meeting-notes/admin-web && npm test -- --run`

Expected: FAIL because app, providers, API client, and pages are missing.

- [ ] **Step 4: Implement a fixed-origin API client with CSRF**

```ts
// admin-web/src/api/client.ts
const csrfToken = () => document.cookie
  .split("; ")
  .find((part) => part.startsWith("am_csrf="))
  ?.split("=")[1] ?? "";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/v1/")) throw new Error("API path must be same-origin");
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) headers.set("X-CSRF-Token", csrfToken());
  const response = await fetch(path, { ...init, headers, credentials: "include", redirect: "error" });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json() as Promise<T>;
}
```

- [ ] **Step 5: Implement AuthProvider and Google button**

Before rendering the Google button, fetch `/v1/auth/google/nonce` and pass the returned nonce to the Google Identity component. The callback sends `{id_token: credential, client_type: "web", nonce}` to `/v1/auth/google`; it never writes the credential, nonce, or session token to localStorage/sessionStorage. `AuthProvider` calls `/v1/auth/me` at startup, renders a loading state, and clears user state on 401.

```tsx
// core callback contract
const onGoogleSuccess = async ({ credential }: CredentialResponse) => {
  if (!credential) return setError("Google ไม่ได้ส่งข้อมูลยืนยันตัวตน");
  await api<AuthResponse>("/v1/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: credential, client_type: "web", nonce }),
  });
  await refreshSession();
};
```

- [ ] **Step 6: Implement organization and member pages**

Required states for both pages:

- loading skeleton;
- empty organization/member/request state;
- API error with retry button;
- success confirmation for invitation/approval/suspension;
- disabled buttons while mutation is pending;
- no owner-demotion or self-promotion control in the UI, while backend remains authoritative.

Use normal JSX text rendering only. Do not use `dangerouslySetInnerHTML`, user-controlled URLs, service-worker caching of authenticated data, or third-party analytics.

Implement `MfaPage` with an enrollment state that displays the `otpauth_uri` as text plus a locally rendered QR code, a six-digit confirmation input, a verification state for returning administrators, and lockout messaging for HTTP 429. Do not persist the secret or code in Web Storage; clear both from React state immediately after confirmation or navigation.

- [ ] **Step 7: Run frontend tests, typecheck, and production build**

Run: `cd ai-meeting-notes/admin-web && npm test -- --run && npm run build`

Expected: all tests PASS and Vite production build exits 0.

- [ ] **Step 8: Commit the admin application**

```bash
git add ai-meeting-notes/admin-web
git commit -m "feat: add secure organization administration web app"
```

---

### Task 8: End-to-End Security Contract and Phase 1 Runbook

**Files:**
- Create: `ai-meeting-notes/backend/tests/test_security_contract.py`
- Create: `ai-meeting-notes/README.md`
- Create: `ai-meeting-notes/docs/phase-1-security-checklist.md`
- Modify: `ai-meeting-notes/compose.yaml`
- Modify: `ai-meeting-notes/backend/app/main.py`

**Interfaces:**
- Consumes: all Phase 1 endpoints and UI build
- Produces: repeatable Phase 1 verification command and documented handoff contract for Android/recording Phase 2

- [ ] **Step 1: Write failing security-contract tests**

```python
# backend/tests/test_security_contract.py
def test_error_response_does_not_leak_stack_trace(client):
    response = client.get("/v1/organizations/not-a-uuid")
    assert response.status_code in {404, 422}
    body = response.text.lower()
    assert "traceback" not in body
    assert "sqlalchemy" not in body


def test_cors_rejects_unknown_origin(client):
    response = client.options(
        "/v1/auth/me",
        headers={
            "Origin": "https://attacker.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") is None


def test_android_bearer_request_is_not_subject_to_browser_csrf(client, android_session):
    response = client.post(
        "/v1/organizations",
        headers={"Authorization": f"Bearer {android_session}"},
        json={"name": "องค์กรทดสอบ"},
    )
    assert response.status_code == 201
```

- [ ] **Step 2: Run the full suite before fixes**

Run: `cd ai-meeting-notes/backend && uv run pytest -q`

Expected: at least one new contract test FAILS until middleware ordering and error responses satisfy the contract.

- [ ] **Step 3: Add response security headers and generic error handling**

```python
# middleware contract added in app/main.py
@app.middleware("http")
async def security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response
```

For unexpected exceptions, log a generated correlation UUID and return `{"detail":"internal server error","correlation_id":"..."}` without exception text. Do not log request bodies or Authorization/Cookie headers.

- [ ] **Step 4: Document setup, threat boundaries, and Phase 2 contracts**

`README.md` must contain exact commands:

```bash
docker compose up -d postgres
cd backend
uv sync --frozen
uv run alembic upgrade head
uv run pytest -q
uv run ruff check .
cd ../admin-web
npm ci
npm test -- --run
npm run build
```

Document these frozen Phase 2 contracts:

- Android exchanges Google credential at `POST /v1/auth/google` with `client_type=android`.
- Android sends returned opaque token in `Authorization: Bearer` and stores it in Android Keystore-backed storage.
- Protected resource APIs always require an organization ID and perform backend membership checks.
- Public identifiers are UUID strings.
- Audit calls accept metadata only and reject content-like keys.

- [ ] **Step 5: Run complete Phase 1 verification**

Run:

```bash
cd ai-meeting-notes
docker compose up -d postgres
cd backend
uv sync --frozen
uv run alembic upgrade head
uv run pytest -q
uv run ruff check .
cd ../admin-web
npm ci
npm test -- --run
npm run build
```

Expected: every command exits 0, backend reports zero failed tests, frontend reports zero failed tests, and the production build succeeds.

- [ ] **Step 6: Perform focused manual checks**

1. Sign in with a personal Gmail account and verify one personal workspace appears.
2. Create an organization, invite a second Gmail account, and verify the second account cannot enter before acceptance.
3. Accept the invitation once and verify replay fails.
4. Suspend the second account and verify access returns 404 immediately.
5. Attempt an admin operation without recent MFA and verify it is blocked.
6. Inspect audit events and verify there are no tokens, emails, invitation codes, or content fields.

- [ ] **Step 7: Commit Phase 1 verification and runbook**

```bash
git add ai-meeting-notes
git commit -m "test: verify foundation security and tenant contracts"
```

---

## Phase 1 Definition of Done

- Google Sign-in works for any verified Google account without storing Google passwords.
- Each new user receives exactly one personal workspace.
- Organization access requires accepted invitation or approved membership request.
- Suspended and cross-tenant users receive no resource disclosure.
- Owner/admin/reviewer/member rules are enforced on the backend.
- Cookie mutations require CSRF; Android bearer requests do not.
- Admin endpoints require recent application-verifiable MFA and remain blocked until MFA is present.
- Audit rows are append-only and contain metadata only.
- Production configuration disables debug and public API docs and uses strict CORS/host settings.
- Backend tests, migrations, Ruff, frontend tests, and frontend production build all pass in one documented command sequence.
- Phase 2 may rely on the frozen authentication, UUID, tenant, and audit interfaces documented above.
