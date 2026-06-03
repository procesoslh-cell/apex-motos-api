import base64, hashlib, hmac, json, os, time

SECRET = os.getenv('SECRET_KEY') or os.getenv('JWT_SECRET') or 'apex-motos-secret-cambiar'
TOKEN_DAYS = int(os.getenv('TOKEN_DAYS', '30'))

def hash_password(p):
    return hashlib.sha256(p.encode()).hexdigest()

def verify_password(p,h):
    return hash_password(p)==h

def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip('=')

def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + '=' * (-len(data) % 4))

def create_token(uid):
    payload = {'uid': uid, 'exp': int(time.time()) + TOKEN_DAYS * 24 * 60 * 60}
    body = _b64(json.dumps(payload, separators=(',', ':')).encode())
    sig = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest()
    return body + '.' + _b64(sig)

def user_id_from_token(t):
    try:
        body, sig = t.split('.', 1)
        expected = _b64(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(_unb64(body))
        if int(payload.get('exp', 0)) < int(time.time()):
            return None
        return payload.get('uid')
    except Exception:
        return None
