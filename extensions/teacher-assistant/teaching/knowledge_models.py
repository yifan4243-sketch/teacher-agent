from pydantic import Field

from .models import Input


class ImportBook(Input):
    course_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    path: str = Field(min_length=1, max_length=2048)
    textbook_id: str | None = Field(default=None, min_length=1, max_length=64)


class UploadBegin(Input):
    course_id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
    filename: str = Field(min_length=1, max_length=200)
    total_bytes: int = Field(ge=1, le=50 * 1024 * 1024, strict=True)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    textbook_id: str | None = Field(default=None, min_length=1, max_length=64)


class UploadChunk(Input):
    id: str = Field(min_length=1, max_length=64)
    offset: int = Field(ge=0, strict=True)
    content_base64: str = Field(min_length=1, max_length=700000)


class VersionFilter(Input):
    version_id: str = Field(min_length=1, max_length=64)
    offset: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=50, ge=1, le=200, strict=True)


class SourceSearch(Input):
    course_id: str = Field(min_length=1, max_length=64)
    query: str = Field(min_length=1, max_length=300)
    version_id: str | None = Field(default=None, min_length=1, max_length=64)
    chapter_id: str | None = Field(default=None, min_length=1, max_length=64)
    limit: int = Field(default=20, ge=1, le=100, strict=True)


class SemanticSearch(SourceSearch):
    allow_model_call: bool = Field(default=False, strict=True)


class ChapterUpdate(Input):
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)


class KnowledgeReview(Input):
    id: str = Field(min_length=1, max_length=64)
    title: str = Field(min_length=1, max_length=200)
