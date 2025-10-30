FROM python:3.13-slim

# Install uv.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app
COPY pyproject.toml uv.lock ./

# Install the application dependencies.
RUN rm -rf .venv && uv sync --frozen --no-cache --no-dev

# Copy the application into the container.
COPY . .

EXPOSE 8000

# Run the application.
CMD ["uv", "run", "fastapi", "run", "main.py", "--port", "8000", "--host", "0.0.0.0"]