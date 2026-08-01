# Server
PORT=4000
BASE_URL=https://assets.hjorthene.dk
SESSION_SECRET=change-me-to-a-long-random-string

# Sæt til true for at teste UDEN Authentik - logger dig automatisk ind som
# en lokal test-admin. SKAL være false/fjernet i produktion.
DEV_NO_AUTH=false

# Storage
UPLOAD_DIR=./uploads
DATA_DIR=./data
MAX_UPLOAD_SIZE_MB=500
ALLOWED_FILE_TYPES=*

# SQLite
DB_FILE=./data/hjorthene.db

# Authentik (OIDC)
AUTHENTIK_ISSUER_URL=https://authentik.hjorthene.dk/application/o/hjorthene-assets/
AUTHENTIK_CLIENT_ID=your-client-id
AUTHENTIK_CLIENT_SECRET=your-client-secret
AUTHENTIK_REDIRECT_URI=https://assets.hjorthene.dk/auth/callback
AUTHENTIK_LOGOUT_REDIRECT=https://assets.hjorthene.dk/

# Role mapping - Authentik group name -> app role
# Matched case-insensitively against the "groups" claim
ROLE_GROUP_ADMIN=Hjorthene Assets Admins
ROLE_GROUP_EDITOR=Hjorthene Assets Editors
# Everyone else defaults to "viewer"
