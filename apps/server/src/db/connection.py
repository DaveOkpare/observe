import os
from typing import Optional
import asyncpg


_conn_pool: Optional[asyncpg.Pool] = None


async def init_db() -> None:
    """
    Initialize the database connection pool.
    """
    global _conn_pool
    if _conn_pool is not None:
        return
    try:
        _conn_pool = await asyncpg.create_pool(
            dsn=os.getenv("DATABASE_URL"),
            max_size=20,
            min_size=10,
            max_queries=50000,
            max_inactive_connection_lifetime=300,
            command_timeout=60,
        )
    except Exception as e:
        print(e)
        raise


async def get_db() -> asyncpg.Pool:
    """
    Get the database connection pool.
    """
    global _conn_pool
    if _conn_pool is None:
        raise Exception("Database connection pool is not initialized")
    return _conn_pool


async def close_db() -> None:
    """
    Close the database connection pool.
    """
    global _conn_pool
    if _conn_pool is not None:
        await _conn_pool.close()
