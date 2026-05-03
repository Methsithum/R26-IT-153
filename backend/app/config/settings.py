from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    mongodb_url: str
    database_name: str
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"
    max_questions_per_session: int = 12

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()