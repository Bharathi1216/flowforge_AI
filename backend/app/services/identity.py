from fastapi import HTTPException
from app.db.models import Repository


def find_repository(repo_id, user_id, db):
    query = db.query(Repository).filter(
        Repository.user_id == user_id, Repository.is_accessible.is_(True)
    )
    repository = query.filter(Repository.github_repo_id == str(repo_id)).one_or_none()
    if repository:
        return repository
    matches = query.filter(Repository.name == str(repo_id)).limit(2).all()
    if len(matches) > 1:
        raise HTTPException(409, "Repository name is ambiguous; use its GitHub repository ID")
    return matches[0] if matches else None
