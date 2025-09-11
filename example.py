import os
from fastapi import FastAPI
import logfire

os.environ["OTEL_EXPORTER_OTLP_ENDPOINT"] = "http://localhost:4318"  # HTTP endpoint
logfire.configure(send_to_logfire=False, service_name="seed-app")

app = FastAPI()

# Instrument FastAPI with Logfire (gets rich context automatically)
logfire.instrument_fastapi(app)


@app.get("/")
def read_root():
    logfire.debug("Debug: Root endpoint accessed")
    logfire.info("Info: Root endpoint accessed")
    logfire.warn("Warning: Root endpoint accessed")
    logfire.error("Error: Root endpoint accessed")
    return {"Hello": "World"}
