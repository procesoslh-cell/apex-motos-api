import hashlib,secrets
TOKENS={}
def hash_password(p): return hashlib.sha256(p.encode()).hexdigest()
def verify_password(p,h): return hash_password(p)==h
def create_token(uid):
    t=secrets.token_urlsafe(32); TOKENS[t]=uid; return t
def user_id_from_token(t): return TOKENS.get(t)
