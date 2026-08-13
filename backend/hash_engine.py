import hashlib
import os

SUPPORTED_ALGORITHMS = {
    'sha256': hashlib.sha256,
    'sha512': hashlib.sha512,
    'md5': hashlib.md5,
    'sha1': hashlib.sha1,
    'sha3_256': hashlib.sha3_256,
    'sha3_512': hashlib.sha3_512,
}

ALGORITHM_LABELS = {
    'sha256': 'SHA-256',
    'sha512': 'SHA-512',
    'md5': 'MD5 (Legacy – Not Secure)',
    'sha1': 'SHA-1 (Legacy)',
    'sha3_256': 'SHA-3 256',
    'sha3_512': 'SHA-3 512',
}

SECURE_ALGORITHMS = ['sha256', 'sha512', 'sha3_256', 'sha3_512']

CHUNK_SIZE = 65536  # 64 KB

def calculate_hash(file_path: str, algorithm: str = 'sha256') -> str:
    """Calculate cryptographic hash of a file."""
    algorithm = algorithm.lower().replace('-', '_')
    if algorithm not in SUPPORTED_ALGORITHMS:
        raise ValueError(f"Unsupported algorithm: {algorithm}. Supported: {list(SUPPORTED_ALGORITHMS.keys())}")
    
    hasher = SUPPORTED_ALGORITHMS[algorithm]()
    
    with open(file_path, 'rb') as f:
        while chunk := f.read(CHUNK_SIZE):
            hasher.update(chunk)
    
    return hasher.hexdigest()

def calculate_hash_from_bytes(data: bytes, algorithm: str = 'sha256') -> str:
    """Calculate hash from bytes."""
    algorithm = algorithm.lower().replace('-', '_')
    if algorithm not in SUPPORTED_ALGORITHMS:
        raise ValueError(f"Unsupported algorithm: {algorithm}")
    
    hasher = SUPPORTED_ALGORITHMS[algorithm](data)
    return hasher.hexdigest()

def calculate_all_hashes(file_path: str) -> dict:
    """Calculate all supported hashes for a file."""
    results = {}
    for algo in ['sha256', 'sha512', 'sha3_256', 'sha3_512', 'md5']:
        try:
            results[algo] = calculate_hash(file_path, algo)
        except Exception as e:
            results[algo] = f"ERROR: {str(e)}"
    return results

def verify_integrity(trusted_hash: str, current_hash: str) -> dict:
    """Compare two hashes and return verification result."""
    trusted_clean = trusted_hash.strip().lower()
    current_clean = current_hash.strip().lower()
    
    match = trusted_clean == current_clean
    
    return {
        'verified': match,
        'status': 'INTEGRITY_VERIFIED' if match else 'MODIFICATION_DETECTED',
        'status_label': 'INTEGRITY VERIFIED' if match else 'FILE MODIFICATION DETECTED',
        'trusted_hash': trusted_hash,
        'current_hash': current_hash,
        'match': match
    }

def is_algorithm_secure(algorithm: str) -> bool:
    """Check if an algorithm is considered cryptographically secure."""
    return algorithm.lower().replace('-', '_') in SECURE_ALGORITHMS
