# Dent API reference

Dent is schema-driven. The catalog is the contract for entity names, fields, relations, actions, access, and request parameters.

## Catalogs

- Tenant catalog: `GET /api/v1/schema/`
- Platform catalog: `GET /platform/api/v1/schema/` on the Platform host

Fetch the catalog before writes. Confirm the entity's fields and action parameters there; for example, Funnel Step `status` is a catalog field and is updated through the generic step update route.

## Tenant route grammar

- `GET /api/v1/{entities}` lists records.
- `GET /api/v1/{entities}/{id}` reads one record.
- `POST /api/v1/{entities}` creates one record.
- `POST /api/v1/{entities}/{id}` updates one record.
- `DELETE /api/v1/{entities}/{id}` deletes one record when allowed.
- `GET|POST|DELETE /api/v1/{entities}/{action}` invokes a collection action.
- `GET|POST|DELETE /api/v1/{entities}/{id}/{action}` invokes a member action.
- Nested routes keep the parent in the path, for example `/api/v1/funnels/{funnelId}/steps`, `/api/v1/courses/{courseId}/sections`, and `/api/v1/sections/{sectionId}/lessons`.

## Public Funnel requests

- Publish public Funnel Steps before opening `viewUrl`, submitting forms, changing the Cart, or submitting Checkout.
- `replace-design` returns Design data, not Step metadata. Read the Step after publishing to confirm `status`, `viewUrl`, and derived flags such as `hasOptinAction` and `hasBuilder`.
- Public form submit path: `GET` the Step `viewUrl` with cookies, then `POST /api/v1/forms/submit` with `{ "owner": {"type": "step", "id": stepId}, "form": "form-key", "fields": {...} }` using those cookies.
- Find a captured Contact with `GET /api/v1/contacts?search=<email>`.

## Analytics dimensions

`GET /api/v1/dent/breakdown` and `GET /api/v1/dent/export-breakdown` accept `dimension`: `source`, `referrer`, `campaign`, `country`, `region`, `city`, `device`, `browser`, `entry_pages`.

<!-- dent:cli:start -->
`dent api` fetches the tenant catalog once per invocation and resolves the HTTP method from the catalog action mode: `read` → `GET`, `write`/`remote` → `POST`, and `destroy` → `DELETE`. `--method` is the explicit override. Bare collection and nested-collection forms list by default; pass `--data` or an explicit method to create.
<!-- dent:cli:end -->

## Auth

Every request uses bearer auth:

```http
Authorization: Bearer <personal access token>
Accept: application/json
```

<!-- dent:cli:start -->
For CLI users, `dent login` defaults to the production Dent Platform browser device-code flow, lets multi-Site users pick the Site in the browser, and stores the credential. Use `--site-url` or `DENT_SITE_URL` for staging or local development. When using `--stdin` or `--token-prompt` with a Site URL whose Platform API lives on a different host, pass `--platform-url` or set `DENT_PLATFORM_URL` so logout can revoke the token. For CSV exports, set `Accept: text/csv`. Never pass tokens as command-line arguments.

`dent logout` revokes the stored token server-side with `DELETE /platform/api/v1/tokens/{id}`, then removes the local config. If the revocation request fails, it prints the failure and still removes the local config.
<!-- dent:cli:end -->
<!-- dent:web:start -->
For Claude web, the user provides the bearer token for this chat. For CSV exports, set `Accept: text/csv`. Never write the token to a file.
<!-- dent:web:end -->
