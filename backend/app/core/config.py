from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):

    PROJECT_NAME: str = "Vendor Reliability Intelligence & Procurement Risk Management Platform"

    API_V1_STR: str = "/api"

    # JWT Security
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Database
    DATABASE_URL: str

    # CORS
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
        "http://localhost:8000",
        "http://127.0.0.1:8000"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(
        cls,
        v: Union[str, List[str]]
    ) -> List[str]:

        if isinstance(v, str) and not v.startswith("["):
            return [
                i.strip()
                for i in v.split(",")
                if i.strip()
            ]

        if isinstance(v, list):
            return v

        if isinstance(v, str):
            return [v]

        raise ValueError(v)

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )


settings = Settings()