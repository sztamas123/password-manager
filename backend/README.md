# Backend

NestJS API with PostgreSQL health checks, password-based authentication,
encryption-profile storage, and owner-scoped opaque ciphertext CRUD.

The backend intentionally has no dependency on the client crypto package and
has no decrypt operation. It validates only the versioned ciphertext envelope,
payload size, ownership, and structural relationships.

See the repository-level `README.md` for setup and verification commands.
