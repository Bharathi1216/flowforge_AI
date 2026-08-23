# Worker (Celery & Redis)

Handles asynchronous tasks:
- Periodically fetching repository workflows from GitHub.
- Parsing and chunking log files for vector database embedding.
- Running heavy AI analysis workflows in the background.
