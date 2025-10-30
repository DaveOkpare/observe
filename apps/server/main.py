import json
from fastapi import FastAPI, Request
from .models import TraceRequest

app = FastAPI()


@app.post("/v1/traces")
async def get_traces(request: Request):
    print(json.dumps(await request.json(), indent=2))
    return {"partialSuccess": {}}
