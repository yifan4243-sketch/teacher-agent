"""Explicit image authorization, integer-dollar accounting, and per-page job identities."""

from pydantic import Field

from .blueprint_models import PageRequest
from .models import Identifier, Input


class ImageBudget(Input):
    blueprint_id: str = Field(min_length=1, max_length=64)
    budget_micro_usd: int = Field(ge=0, le=1_000_000_000_000, strict=True)


class ImageReserve(PageRequest):
    estimated_micro_usd: int = Field(ge=1, le=1_000_000_000, strict=True)
    allow_model_call: bool = Field(default=False, strict=True)
    force_regenerate: bool = Field(default=False, strict=True)


class ImageAbandon(Identifier):
    acknowledge_possible_cost: bool = Field(default=False, strict=True)


class BlueprintFilter(Input):
    blueprint_id: str = Field(min_length=1, max_length=64)


class ImageList(BlueprintFilter):
    offset: int = Field(default=0, ge=0, strict=True)
    limit: int = Field(default=20, ge=1, le=100, strict=True)
