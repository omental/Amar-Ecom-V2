from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "Amar eCom API"
    APP_ENV: str = "development"
    DATABASE_URL: str
    SECRET_KEY: str = "change-this-secret-key"
    APP_SECRET_KEY: str | None = None
    FERNET_SECRET_KEY: str | None = None
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    FRONTEND_URL: str = "http://localhost:3000"
    MEDIA_STORAGE_DRIVER: str = "local"
    MEDIA_STORAGE_ROOT: str = "storage/media"
    MEDIA_MAX_UPLOAD_MB: int = 10
    MEDIA_PUBLIC_BASE_URL: str | None = None
    DEFAULT_SIGNUP_PLAN_KEY: str = "growth"
    BILLING_PROVIDER: str = "test"
    BILLING_WEBHOOK_SECRET: str = "development-billing-secret-change-me"
    BILLING_GRACE_DAYS: int = 7
    BILLING_MAX_WEBHOOK_BYTES: int = 262144
    STOREFRONT_BASE_DOMAIN: str = "amar-ecom.com"
    STOREFRONT_PUBLIC_SCHEME: str = "https"
    STOREFRONT_DEV_BASE_DOMAIN: str = "localhost"
    STOREFRONT_DEV_SCHEME: str = "http"
    STOREFRONT_DEV_PORT: int = 3000
    STOREFRONT_WILDCARD_TLS_ACTIVE: bool = False
    STOREFRONT_ALLOW_LEGACY_FALLBACK: bool = False
    STOREFRONT_INTERNAL_SECRET: str | None = None
    STOREFRONT_TRUSTED_PROXY_IPS: str = ""
    CUSTOM_DOMAIN_CNAME_TARGET: str = "domains.amar-ecom.com"
    CUSTOM_DOMAIN_IPV4_TARGETS: str = ""
    CUSTOM_DOMAIN_IPV6_TARGETS: str = ""
    CUSTOM_DOMAIN_MAX_PER_STORE: int = 2
    DOMAIN_VERIFICATION_TOKEN_HOURS: int = 168
    DOMAIN_VERIFICATION_RECHECK_SECONDS: int = 30
    DNS_RESOLVER_TIMEOUT_SECONDS: float = 4.0
    CERTIFICATE_PROVIDER: str = "test"
    CERTIFICATE_TEST_OUTCOME: str = "active"
    DNS_PROVIDER: str = "test"
    DNS_PROVIDER_API_URL: str | None = None
    DNS_PROVIDER_API_KEY: str | None = None
    DNS_PROVIDER_SERVER_ID: str = "localhost"
    DNS_NAMESERVERS: str = "ns1.amardns.com,ns2.amardns.com"
    DNS_DEFAULT_TTL: int = 3600
    DNS_MIN_TTL: int = 60
    DNS_MAX_TTL: int = 86400
    DNS_MAX_RECORDS_PER_ZONE: int = 500
    DNS_DELEGATION_RECHECK_SECONDS: int = 30
    META_APP_ID: str | None = None
    META_APP_SECRET: str | None = None
    META_GRAPH_API_VERSION: str = "v23.0"
    META_WEBHOOK_VERIFY_TOKEN: str | None = None
    META_OAUTH_REDIRECT_URI: str | None = None
    META_WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID: str | None = None
    META_GRAPH_TIMEOUT_SECONDS: float = 10.0
    META_GRAPH_MAX_RETRIES: int = 2
    META_OAUTH_STATE_MINUTES: int = 15
    META_PROVIDER_EVENT_RETENTION_DAYS: int = 30
    META_WEBHOOK_MAX_BYTES: int = 1048576
    META_FREEFORM_WINDOW_HOURS: int = 24
    AI_PROVIDER: str = "disabled"
    AI_MODEL: str = "gpt-5-mini"
    AI_API_KEY: str | None = None
    AI_REQUEST_TIMEOUT_SECONDS: float = 20.0
    AI_MAX_STEPS: int = 6
    AI_MAX_TOOL_CALLS: int = 8
    AI_MAX_OUTPUT_TOKENS: int = 500
    AI_MAX_CONTEXT_MESSAGES: int = 12
    AI_MAX_CONCURRENT_EXECUTIONS_PER_STORE: int = 2

    JWT_ALGORITHM: str = "HS256"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
