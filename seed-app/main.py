import logfire
from fastapi import FastAPI
from pydantic_ai import Agent
import os

# Configure Logfire to send to your collector instead of Logfire SaaS
os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://localhost:4318"  # HTTP endpoint
logfire.configure(send_to_logfire=False, service_name="seed-app")

app = FastAPI()

# Instrument FastAPI with Logfire (gets rich context automatically)
logfire.instrument_fastapi(app)


@app.get("/")
def read_root():
    return {"Hello": "World"}


@app.get("/items/{item_id}")
def read_item(item_id: int):
    return {"item_id": item_id}


@app.get("/chat")
def chat():
    agent = Agent(model="openai:gpt-4o-mini", instrument=True)
    result = agent.run_sync("Hi")
    return {"result": result.output}
