import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import interviewer, report, resume
from app.config import settings
from app.groq_client import AIError, key_configured
from app.schemas import (
    AnswerRequest,
    AnswerResponse,
    ErrorResponse,
    Message,
    Report,
    ReportRequest,
    ResumeParseResponse,
    ResumeProfileOut,
    StartRequest,
    StartResponse,
)

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("interview_coach")


@asynccontextmanager
async def lifespan(_: FastAPI):
    key_state = "configured" if key_configured() else "MISSING — set GROQ_API_KEY in backend/.env"
    print(
        "\n"
        "============================================\n"
        "  AI Interview Coach API\n"
        "============================================\n"
        f"  Model:        {settings.groq_model}\n"
        f"  Groq API key: {key_state}\n"
        f"  CORS origins: {', '.join(settings.cors_origin_list)}"
        + (f"  (+ regex {settings.cors_origin_regex})" if settings.cors_origin_regex else "")
        + "\n"
        "  Docs:         /docs\n"
        "============================================\n",
        flush=True,
    )
    yield


app = FastAPI(
    title="AI Interview Coach API",
    version="0.1.0",
    lifespan=lifespan,
    responses={422: {"model": ErrorResponse}, 502: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=settings.cors_origin_regex or None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Error handling: always return {"detail": "<friendly message>"} ----------


@app.exception_handler(AIError)
async def ai_error_handler(_: Request, exc: AIError):
    return JSONResponse(status_code=exc.status, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else None
    if first and first.get("type") == "json_invalid":
        detail = "The request body must be valid JSON."
    elif first:
        field = ".".join(str(p) for p in first.get("loc", []) if p != "body")
        msg = first.get("msg", "Invalid value").removeprefix("Value error, ")
        detail = f"Invalid {field}: {msg}" if field else msg
    else:
        detail = "The request was invalid."
    return JSONResponse(status_code=422, content={"detail": detail})


@app.exception_handler(Exception)
async def unhandled_error_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong on the server. Please try again."},
    )


# ---------- Routes ----------


@app.get("/")
def root():
    return {"message": "AI Interview Coach API", "docs": "/docs"}


@app.get("/health")
def health():
    return {
        "status": "ok",
        "groq_key_configured": key_configured(),
        "model": settings.groq_model,
    }


@app.post("/interview/start", response_model=StartResponse)
def start_interview(req: StartRequest):
    message = interviewer.opening_message(req.topic, req.difficulty, req.context)
    return StartResponse(message=message, interview_over=False)


@app.post("/interview/answer", response_model=AnswerResponse)
def submit_answer(req: AnswerRequest):
    if req.messages[-1].role != "interviewer":
        raise AIError("The conversation must end with an interviewer message before you answer.", status=422)
    history = [*req.messages, Message(role="candidate", content=req.answer)]
    message, over = interviewer.next_message(req.topic, req.difficulty, history, req.context)
    return AnswerResponse(message=message, interview_over=over)


@app.post("/interview/report", response_model=Report)
def generate_report(req: ReportRequest):
    if not any(m.role == "candidate" for m in req.messages):
        raise AIError("The conversation has no candidate answers to grade yet.", status=422)
    return report.generate_report(req.topic, req.difficulty, req.messages, req.context)


@app.post("/resume/parse", response_model=ResumeParseResponse)
async def parse_resume(file: UploadFile = File(...)):
    filename = file.filename or "resume"
    kind = resume.detect_kind(filename, file.content_type)
    data = await file.read()
    if not data:
        raise AIError("The uploaded file is empty.", status=422)
    if len(data) > resume.MAX_FILE_BYTES:
        raise AIError("That file is too large. Please upload a resume under 5 MB.", status=413)

    text = resume.extract_text(data, kind)
    profile = resume.build_profile(text)
    return ResumeParseResponse(
        filename=filename,
        text=text,
        word_count=len(text.split()),
        profile=ResumeProfileOut(**profile.model_dump()) if profile else None,
    )
