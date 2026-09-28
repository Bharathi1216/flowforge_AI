# Database (PostgreSQL)

Stores persisted relational data including:
- Users & sessions
- Repositories and access control mappings
- Discussions and comment threads
- Log analysis history and RAG indexes

## Organization

- `schema.sql`: PostgreSQL schema
- `local/`: local SQLite runtime data, ignored by Git
