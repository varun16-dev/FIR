"""EvidenceVault Configuration"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from cryptography.fernet import Fernet


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./evidencevault.db"
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ENCRYPTION_KEY: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    MAX_UPLOAD_SIZE_MB: int = 25
    DEMO_MODE: bool = True
    APP_BASE_URL: str = "http://localhost:5173"
    
    # Paths
    BASE_DIR: str = str(Path(__file__).resolve().parent.parent)
    STORAGE_DIR: str = ""
    
    class Config:
        env_file = ".env"
        extra = "allow"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.STORAGE_DIR:
            self.STORAGE_DIR = os.path.join(self.BASE_DIR, "storage", "evidence")
        os.makedirs(self.STORAGE_DIR, exist_ok=True)
        
        # Generate encryption key if not set (persisted by encryption module)
        if not self.ENCRYPTION_KEY:
            from cryptography.fernet import Fernet
            self.ENCRYPTION_KEY = Fernet.generate_key().decode()


settings = Settings()
