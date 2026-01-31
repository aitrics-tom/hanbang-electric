"""
NeMo Guardrails Server for Jeonsilai (전기기사 AI)
Input/Output validation for electrical engineering exam AI service
"""

import re
import os
import json
from typing import Optional
from datetime import datetime

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import structlog

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
)
logger = structlog.get_logger()

# Initialize FastAPI app
app = FastAPI(
    title="Jeonsilai NeMo Guardrails Server",
    description="Input/Output validation for electrical engineering exam AI service (전기기사 AI 풀이 서비스)",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Configuration - 전기기사 도메인 검증 규칙
# =============================================================================

INPUT_RAILS = {
    "topical": {
        "allowed_topics": [
            "전기설비", "전기공사", "전력계통", "시퀀스", "PLC",
            "조명", "역률", "변압기", "접지", "KEC", "전기기사",
            "수변전", "배선", "단락", "과전류", "누전", "콘덴서",
            "임피던스", "전압강하", "광속법", "축전지", "태양광",
            "차단기", "보호계전기", "단선도", "결선도", "제어회로"
        ],
        "blocked_patterns": [
            r"욕설|비속어|공격적",
            r"개인정보|주민등록|전화번호|주소",
            r"해킹|크래킹|불법",
            r"성적|음란|19금"
        ]
    },
    "min_length": 3,
    "max_length": 2000,
    "image": {
        "allowed_formats": ["image/jpeg", "image/png", "image/webp"],
        "max_size_bytes": 10 * 1024 * 1024  # 10MB
    }
}

OUTPUT_RAILS = {
    "quality": {
        "min_confidence": 0.7,
        "required_fields": ["answer", "steps", "formulas"]
    },
    "si_units": ["V", "A", "W", "Ω", "F", "H", "lx", "lm", "cd", "m", "mm²", "kVA", "kVar", "kW", "%"],
    "calculation_tolerance_percent": 1
}

# Unit mappings for normalization (Korean to standard symbols)
UNIT_MAPPINGS = [
    (r"럭스", "lx"),
    (r"루멘", "lm"),
    (r"칸델라", "cd"),
    (r"킬로와트", "kW"),
    (r"와트", "W"),
    (r"볼트", "V"),
    (r"암페어", "A"),
    (r"옴", "Ω"),
    (r"제곱미터", "m²"),
    (r"평방미터", "m²"),
    (r"키로바", "kVA"),
    (r"케이브이에이", "kVA"),
    (r"키로바르", "kVar"),
    (r"케이바르", "kVar"),
    (r"퍼센트", "%"),
    (r"프로", "%"),
]

# Typo corrections for electrical engineering terms
TYPO_MAPPINGS = [
    (r"역율", "역률"),
    (r"조명율", "조명률"),
    (r"인피던스", "임피던스"),
    (r"코사인", "cosθ"),
    (r"코싸인", "cosθ"),
    (r"탄젠트", "tanθ"),
    (r"파이", "π"),
    (r"루트", "√"),
]

# =============================================================================
# Pydantic Models
# =============================================================================

class InputValidationRequest(BaseModel):
    """Request model for input validation"""
    text: Optional[str] = Field(None, description="Text input from user")
    image_base64: Optional[str] = Field(None, alias="imageBase64", description="Base64 encoded image")

    class Config:
        populate_by_name = True


class InputValidationResponse(BaseModel):
    """Response model for input validation"""
    valid: bool = Field(..., description="Whether the input is valid")
    errors: list[str] = Field(default_factory=list, description="List of validation errors")
    normalized_text: Optional[str] = Field(None, alias="normalizedText", description="Normalized text after processing")

    class Config:
        populate_by_name = True


class OutputValidationRequest(BaseModel):
    """Request model for output validation"""
    answer: Optional[str] = Field(None, description="Final answer")
    steps: Optional[list[dict]] = Field(None, description="Solution steps")
    formulas: Optional[list[str]] = Field(None, description="Formulas used")
    confidence: Optional[float] = Field(None, description="Confidence score")
    related_kec: Optional[list[str]] = Field(None, alias="relatedKEC", description="Related KEC codes")

    class Config:
        populate_by_name = True


class OutputValidationResponse(BaseModel):
    """Response model for output validation"""
    valid: bool = Field(..., description="Whether the output is valid")
    warnings: list[str] = Field(default_factory=list, description="List of validation warnings")
    corrections: list[str] = Field(default_factory=list, description="List of suggested corrections")


class HealthResponse(BaseModel):
    """Response model for health check"""
    status: str
    timestamp: str
    version: str


# =============================================================================
# Helper Functions
# =============================================================================

def normalize_text(text: str) -> str:
    """
    Normalize text by converting Korean units to standard symbols,
    fixing common typos, and standardizing whitespace.
    """
    normalized = text.strip()

    # Apply unit mappings
    for pattern, replacement in UNIT_MAPPINGS:
        normalized = re.sub(pattern, replacement, normalized)

    # Apply typo corrections
    for pattern, replacement in TYPO_MAPPINGS:
        normalized = re.sub(pattern, replacement, normalized)

    # Normalize abbreviations
    normalized = re.sub(r"pf\s*=?\s*(\d)", r"역률 \1", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"cos\s*=?\s*(\d)", r"cosθ = \1", normalized, flags=re.IGNORECASE)

    # Normalize whitespace
    normalized = re.sub(r"\s+", " ", normalized).strip()

    return normalized


def check_blocked_patterns(text: str) -> Optional[str]:
    """Check if text contains any blocked patterns"""
    for pattern in INPUT_RAILS["topical"]["blocked_patterns"]:
        if re.search(pattern, text, re.IGNORECASE):
            return "부적절한 내용이 포함되어 있습니다."
    return None


def check_relevance(text: str) -> bool:
    """Check if text contains relevant electrical engineering topics"""
    topics = INPUT_RAILS["topical"]["allowed_topics"]
    return any(topic in text for topic in topics)


def estimate_base64_size(base64_str: str) -> int:
    """Estimate the original file size from base64 string"""
    return int((len(base64_str) * 3) / 4)


# =============================================================================
# API Endpoints
# =============================================================================

@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint
    Returns server status, timestamp, and version
    """
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0"
    )


@app.post("/validate/input", response_model=InputValidationResponse, tags=["Validation"])
async def validate_input(request: InputValidationRequest):
    """
    Validate user input before processing

    Checks:
    - Text length constraints (3-2000 characters)
    - Blocked patterns (inappropriate content)
    - Image size (max 10MB)
    - At least one input (text or image) is provided

    Returns:
    - Validation result with errors and normalized text
    """
    errors: list[str] = []
    normalized_text: Optional[str] = None

    logger.info("validating_input", has_text=bool(request.text), has_image=bool(request.image_base64))

    # Text validation
    if request.text:
        # Normalize text
        normalized_text = normalize_text(request.text)

        # Length validation
        if len(normalized_text) < INPUT_RAILS["min_length"]:
            errors.append("질문이 너무 짧습니다. 좀 더 구체적으로 입력해주세요.")

        if len(normalized_text) > INPUT_RAILS["max_length"]:
            errors.append("질문이 너무 깁니다. 2000자 이하로 입력해주세요.")

        # Blocked patterns check
        blocked_error = check_blocked_patterns(normalized_text)
        if blocked_error:
            errors.append(blocked_error)

        # Log relevance (not enforced, just tracked)
        is_relevant = check_relevance(normalized_text)
        logger.info("input_relevance_check", is_relevant=is_relevant)

    # Image validation
    if request.image_base64:
        estimated_size = estimate_base64_size(request.image_base64)
        if estimated_size > INPUT_RAILS["image"]["max_size_bytes"]:
            errors.append("이미지 크기가 10MB를 초과합니다.")

    # At least one input required
    if not request.text and not request.image_base64:
        errors.append("문제 텍스트 또는 이미지를 입력해주세요.")

    is_valid = len(errors) == 0

    logger.info("input_validation_complete", valid=is_valid, error_count=len(errors))

    return InputValidationResponse(
        valid=is_valid,
        errors=errors,
        normalized_text=normalized_text
    )


@app.post("/validate/output", response_model=OutputValidationResponse, tags=["Validation"])
async def validate_output(request: OutputValidationRequest):
    """
    Validate AI output before returning to user

    Checks:
    - Required fields (answer, steps, formulas)
    - Unit presence in numerical answers
    - KEC code references (informational only)

    Returns:
    - Validation result with warnings and corrections
    """
    warnings: list[str] = []
    corrections: list[str] = []

    logger.info("validating_output",
                has_answer=bool(request.answer),
                has_steps=bool(request.steps),
                has_formulas=bool(request.formulas))

    # Required fields check
    required_fields = OUTPUT_RAILS["quality"]["required_fields"]
    for field in required_fields:
        value = getattr(request, field, None)
        if not value:
            warnings.append(f"{field} 필드가 누락되었습니다.")

    # Answer format validation
    if request.answer:
        # Check for units in numerical answers
        has_unit = any(unit in request.answer for unit in OUTPUT_RAILS["si_units"])
        has_number = bool(re.search(r"\d", request.answer))

        if has_number and not has_unit:
            warnings.append("답에 단위가 누락된 것 같습니다.")

    # Steps validation
    if request.steps:
        for i, step in enumerate(request.steps):
            if not step.get("title") or not step.get("content"):
                warnings.append(f"풀이 단계 {i+1}의 제목 또는 내용이 누락되었습니다.")

    # Confidence check (informational only)
    if request.confidence is not None and request.confidence < OUTPUT_RAILS["quality"]["min_confidence"]:
        warnings.append(f"신뢰도가 {OUTPUT_RAILS['quality']['min_confidence'] * 100}% 미만입니다.")

    # KEC validation (informational only, trust agent's judgment)
    if request.related_kec:
        logger.info("kec_references", codes=request.related_kec)

    is_valid = len(corrections) == 0

    logger.info("output_validation_complete",
                valid=is_valid,
                warning_count=len(warnings),
                correction_count=len(corrections))

    return OutputValidationResponse(
        valid=is_valid,
        warnings=warnings,
        corrections=corrections
    )


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "service": "Jeonsilai NeMo Guardrails Server",
        "description": "전기기사 AI 풀이 서비스 입력/출력 검증 서버",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "validate_input": "/validate/input",
            "validate_output": "/validate/output",
            "docs": "/docs"
        }
    }


# =============================================================================
# Application Startup
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "0.0.0.0")

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("ENV", "development") == "development"
    )
