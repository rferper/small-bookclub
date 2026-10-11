"""Offline drift checking of every real implemented operation, never future stubs."""

import copy
from pathlib import Path

import yaml

METHODS = {"get", "put", "post", "delete", "options", "head", "patch", "trace"}
CONTRACT_PATH = Path(__file__).resolve().parents[2] / "openapi.yaml"
ANNOTATIONS = {"description", "title", "examples", "example"}


def read_contract():
    return yaml.safe_load(CONTRACT_PATH.read_text(encoding="utf-8"))


def resolve(document, value, seen=()):
    """Resolve local refs including their siblings; refuse network and cyclic refs."""
    if isinstance(value, list):
        return [resolve(document, child, seen) for child in value]
    if not isinstance(value, dict):
        return value
    if "$ref" in value:
        ref = value["$ref"]
        if not ref.startswith("#/") or ref in seen:
            raise ValueError(f"Unsupported remote or cyclic reference: {ref}")
        target = document
        for token in ref[2:].split("/"):
            target = target[token.replace("~1", "/").replace("~0", "~")]
        resolved = resolve(document, target, (*seen, ref))
        siblings = resolve(
            document,
            {key: child for key, child in value.items() if key != "$ref"},
            seen,
        )
        if not siblings:
            return resolved
        # JSON Schema siblings are conjunctive, not overrides.
        return {"allOf": [resolved, siblings]}
    return {key: resolve(document, child, seen) for key, child in value.items()}


def normalize_schema(value):
    if isinstance(value, list):
        return [normalize_schema(child) for child in value]
    if not isinstance(value, dict):
        return value
    result = {}
    for key, child in value.items():
        if key in ANNOTATIONS:
            continue
        if key in {"properties", "$defs", "patternProperties", "dependentSchemas"}:
            # Property names such as title/description are real fields, not annotations.
            result[key] = {
                name: normalize_schema(schema) for name, schema in child.items()
            }
        elif key == "required":
            result[key] = sorted(child)
        elif key in {
            "additionalProperties",
            "unevaluatedProperties",
            "propertyNames",
            "contains",
            "items",
            "not",
            "if",
            "then",
            "else",
            "contentSchema",
            "allOf",
            "anyOf",
            "oneOf",
            "prefixItems",
            "unevaluatedItems",
        }:
            result[key] = normalize_schema(child)
        else:
            # Arbitrary keyword data (const/default/dependentRequired/extensions)
            # can contain annotation-like keys whose meaning must be preserved.
            result[key] = copy.deepcopy(child)
    return result


def operations(document):
    return {
        (path, method): operation
        for path, item in document["paths"].items()
        for method, operation in item.items()
        if method in METHODS
    }


def operation_shape(document, path, operation):
    def transport(value):
        return {
            key: normalize_schema(child) if key == "schema" else copy.deepcopy(child)
            for key, child in value.items()
            if key not in ANNOTATIONS
        }

    def media(content):
        return {
            name: transport(resolve(document, value)) for name, value in content.items()
        }

    responses = {}
    for status, response in operation["responses"].items():
        response = resolve(document, response)
        responses[str(status)] = {"content": media(response.get("content", {}))}
        if response.get("headers"):
            responses[str(status)]["headers"] = {
                name: transport(header) for name, header in response["headers"].items()
            }
    request = resolve(document, operation.get("requestBody", {}))
    parameters = document["paths"][path].get("parameters", []) + operation.get(
        "parameters", []
    )
    return {
        "operationId": operation.get("operationId"),
        "security": operation.get("security", document.get("security", [])),
        "responses": responses,
        "requestBody": {
            "required": request.get("required", False),
            "content": media(request.get("content", {})),
        },
        "parameters": [
            transport(resolve(document, parameter)) for parameter in parameters
        ],
    }


def implemented_operations(api):
    """Inventory actual routes, including accidentally schema-hidden handlers.

    Ninja's registry is internal; the locked version and tests guard this adapter.
    """
    from django.urls import reverse

    base = reverse(f"{api.urls_namespace}:api-root").rstrip("/")
    return {
        (
            base
            + "/"
            + "/".join(part.strip("/") for part in (prefix, path) if part.strip("/")),
            method.lower(),
        )
        for prefix, router in api._routers
        for path, view in router.path_operations.items()
        for operation in view.operations
        for method in operation.methods
    }


def check_schema(contract, generated, implemented):
    expected, actual = operations(contract), operations(generated)
    health = ("/api/health", "get")
    if health not in actual or health not in expected:
        raise ValueError("Health must be present in both contract and implementation")
    if set(actual) != set(implemented):
        raise ValueError(
            "Generated schema is missing or inventing registered implemented operations"
        )
    for (path, method), operation in actual.items():
        if (path, method) not in expected:
            raise ValueError(
                f"Undocumented implemented operation: {method.upper()} {path}"
            )
        wanted = operation_shape(contract, path, expected[path, method])
        observed = operation_shape(generated, path, operation)
        if observed != wanted:
            raise ValueError(
                f"Schema drift: {method.upper()} {path}\n"
                f"Expected: {wanted}\nGenerated: {observed}"
            )
    return [
        f"{method.upper()} {path} ({operation['operationId']})"
        for (path, method), operation in actual.items()
    ]


def main():
    import os

    import django

    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()
    from config.api import api

    checked = check_schema(
        read_contract(), api.get_openapi_schema(), implemented_operations(api)
    )
    print(
        f"Implemented subset checked ({len(checked)} operations): " + ", ".join(checked)
    )
    print(
        "Future contract operations are not claimed as implemented; "
        "workflow enforcement remains #72."
    )


if __name__ == "__main__":
    main()
