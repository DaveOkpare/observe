import os
from typing import Optional
import asyncpg


conn_pool: Optional[asyncpg.Pool] = None


async def init_db() -> None:
    """
    Initialize the database connection pool.
    """
    global conn_pool
    try:
        conn_pool = await asyncpg.create_pool(
            dsn=os.getenv("DATABASE_URL"), max_size=20, min_size=10
        )
    except Exception as e:
        print(e)
        raise


async def get_db() -> asyncpg.Pool:
    """
    Get the database connection pool.
    """
    global conn_pool
    try:
        return conn_pool
    except Exception as e:
        print(e)
        raise


async def close_db() -> None:
    """
    Close the database connection pool.
    """
    global conn_pool
    try:
        if conn_pool is not None:
            conn_pool.close()
    except Exception as e:
        print(e)
        raise
