"""Only public process liveness is implemented in this bootstrap."""

from typing import Literal

from ninja import NinjaAPI, Schema
from pydantic import ConfigDict

api = NinjaAPI(
    title="Small Bookclub API", version="1.2.0", docs_url=None, openapi_url=None
)


class Health(Schema):
    model_config = ConfigDict(extra="forbid")
    status: Literal["ok"]


@api.get(
    "/health",
    response={200: Health},
    operation_id="getHealth",
    auth=None,
    openapi_extra={"security": []},
)
def health(request):
    return {"status": "ok"}
