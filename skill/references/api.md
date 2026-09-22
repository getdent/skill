# Resolve and verify a Dent call

Use this when an operation has no worked example in the Dent Process, or when a call came back with an error. The route grammar, the singleton and nested forms, the public Visitor routes, and the auth facts are in the Dent skill itself.

## 1. Find the action in the catalog

Read `GET /api/v1/schema/` and find the entity by its `route`.

- The entity's `fields` say what you may send. A field with `readOnly: true` is refused.
- The entity's `actions` say what it can do. Each action names its `target`, its `mode`, and its `parameters`.

IF no action matches the operation:
### Report the gap
Tell the operator the operation is not in the first-party API. Do not use WordPress routes, and do not invent a route from the pattern of another entity.

## 2. Derive the request from the action

The verb comes from `mode`, and the shape of the path comes from `target`.

- A `collection` action sits at `/api/v1/{route}/{action}`, and a `member` action sits at `/api/v1/{route}/{id}/{action}`.
- A nested entity keeps its parent in the path, and a singleton has no bare list or id form.
- A write sends its parameters as a flat body, and a read sends them as query parameters.

## 3. Send it and read the answer back

### Confirm a write with a second read
Read the record again with its get route and confirm the field you changed. Open the public URL for anything the public sees.
Never: report a write as done from the write response alone.

## 4. Fix the error Dent returned

Each status names its own cause, and none of them is a reason to send the same call again.

IF the status is `401`:
### Re-authenticate
The credential is missing or expired. Get a fresh one through the login path for this harness. Never pass a token as a command-line argument.

IF the status is `404 Action not found`:
### Rebuild the path from the grammar
The path is not in the grammar. The usual causes are a named form of a plain create or update, a flat route for a nested entity, and a bare list on a singleton.

IF the status is `409`:
### Read the Design again and reapply
The `revision` you sent is stale because another writer saved in between. Read the Design, apply your change to what came back, and send it again with the fresh `revision`.

IF the status is `422`:
### Fix what validation named
The write was refused and nothing saved. Read the element-keyed messages and fix the Design or the field they name. Never change the status to get around it.

IF the status is `500` on a relation:
### Send plain ids
A relation list takes plain ids, not objects wrapping an id.
