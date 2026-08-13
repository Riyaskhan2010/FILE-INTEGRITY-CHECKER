import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production-xyz789')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production-abc123')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    
    DATABASE_PATH = os.path.join(BASE_DIR, 'integrity_checker.db')
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    REPORTS_FOLDER = os.path.join(BASE_DIR, 'reports')
    DEMO_FOLDER = os.path.join(BASE_DIR, 'demo_files')
    
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50 MB
    
    ALLOWED_EXTENSIONS = {
        'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx',
        'xls', 'xlsx', 'zip', 'tar', 'gz', 'json', 'xml', 'csv',
        'sql', 'conf', 'cfg', 'ini', 'log', 'md', 'py', 'js', 'ts',
        'html', 'css', 'sh', 'bat', 'exe', 'dll', 'bin', 'iso', 'db'
    }
