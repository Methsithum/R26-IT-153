from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


ENV_FILE = Path(__file__).resolve().parents[2] / ".env"

class Settings(BaseSettings):
    mongodb_url: str
    database_name: str

    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")


settings = Settings()