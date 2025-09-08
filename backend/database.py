import asyncpg


pool: asyncpg.Pool | None = None
DATABASE_URL: str = "postgresql://postgres:postgres@localhost:6432/observability"


async def init_db_pool():
    global pool
    pool = await asyncpg.create_pool(
        DATABASE_URL,
        min_size=10,
        max_size=50,
        max_queries=50000,
        max_inactive_connection_lifetime=300,
        command_timeout=60,
    )
    print("Database pool initialize")


async def close_db_pool():
    global pool
    if pool:
        await pool.close()
        print("Database pool closed")
