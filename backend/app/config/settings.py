<<<<<<< HEAD
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    mongodb_url: str
    database_name: str
    openai_api_key: str
    openai_model: str = "gpt-5.4-mini"
    max_questions_per_session: int = 12

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


=======
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    mongodb_url: str
    database_name: str
    openai_api_key: str
    openai_model: str = "gpt-5.4-mini"
    max_questions_per_session: int = 12

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


>>>>>>> 33fff5ba5378aed4cc902ccfe149e9b96c165473
settings = Settings()