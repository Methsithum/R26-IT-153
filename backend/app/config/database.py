import logging
import socket
from urllib.parse import urlsplit, parse_qsl, urlencode

import dns.resolver
from pymongo import MongoClient
from pymongo.errors import ConfigurationError
from app.config.settings import settings

logger = logging.getLogger(__name__)

# Some networks (e.g. mobile hotspots) can't resolve the SRV/TXT records that
# `mongodb+srv://` URLs need. When that happens we look them up through these
# public resolvers instead and connect with a plain `mongodb://` URL.
FALLBACK_DNS_SERVERS = ["8.8.8.8", "1.1.1.1"]
SERVER_SELECTION_TIMEOUT_MS = 10000

_client = None


def _fallback_resolver() -> dns.resolver.Resolver:
    resolver = dns.resolver.Resolver(configure=False)
    resolver.nameservers = FALLBACK_DNS_SERVERS
    resolver.lifetime = 10
    return resolver


def _route_hosts_through_fallback_dns(hostnames):
    """If system DNS can't resolve the cluster's shard hosts either, resolve
    just those names via the fallback resolver. TLS still verifies against
    the hostname, so only the IP lookup changes."""
    hostnames = set(hostnames)
    resolver = _fallback_resolver()
    original_getaddrinfo = socket.getaddrinfo

    def getaddrinfo(host, port, *args, **kwargs):
        try:
            return original_getaddrinfo(host, port, *args, **kwargs)
        except socket.gaierror:
            if host not in hostnames:
                raise
            ips = [r.address for r in resolver.resolve(host, "A")]
            results = []
            for ip in ips:
                results.extend(original_getaddrinfo(ip, port, *args, **kwargs))
            return results

    socket.getaddrinfo = getaddrinfo


def _srv_to_standard_uri(srv_uri: str) -> str:
    """Resolve a mongodb+srv:// URI via public DNS into a mongodb:// URI."""
    parts = urlsplit(srv_uri)
    host = parts.hostname

    resolver = _fallback_resolver()

    srv_records = resolver.resolve(f"_mongodb._tcp.{host}", "SRV")
    targets = [str(r.target).rstrip(".") for r in srv_records]
    _route_hosts_through_fallback_dns(targets)
    hosts = ",".join(
        f"{target}:{r.port}" for target, r in zip(targets, srv_records)
    )

    # TXT record carries options such as authSource and replicaSet.
    options = {}
    try:
        for record in resolver.resolve(host, "TXT"):
            txt = b"".join(record.strings).decode()
            options.update(parse_qsl(txt))
    except dns.resolver.NoAnswer:
        pass

    options["tls"] = "true"
    options.update(parse_qsl(parts.query))  # explicit URL options win

    userinfo = parts.netloc.rsplit("@", 1)[0] + "@" if "@" in parts.netloc else ""
    path = parts.path or "/"
    return f"mongodb://{userinfo}{hosts}{path}?{urlencode(options)}"


def get_client() -> MongoClient:
    global _client
    if _client is None:
        url = settings.mongodb_url
        try:
            _client = MongoClient(url, serverSelectionTimeoutMS=SERVER_SELECTION_TIMEOUT_MS)
        except ConfigurationError as exc:
            if not url.startswith("mongodb+srv://"):
                raise
            logger.warning(
                "SRV lookup failed with system DNS (%s); retrying via %s",
                exc, ", ".join(FALLBACK_DNS_SERVERS),
            )
            _client = MongoClient(
                _srv_to_standard_uri(url),
                serverSelectionTimeoutMS=SERVER_SELECTION_TIMEOUT_MS,
            )
    return _client


def get_db():
    return get_client()[settings.database_name]


class _LazyCollection:
    """Defers connecting until the collection is actually used, so importing
    a model with `x_collection = db["x"]` doesn't hit the network."""

    def __init__(self, name):
        self._name = name

    def _collection(self):
        return get_db()[self._name]

    def __getattr__(self, attr):
        return getattr(self._collection(), attr)

    def __getitem__(self, key):
        return self._collection()[key]


class _LazyDB:
    """Lets `from app.config.database import db` keep working."""

    def __getitem__(self, name):
        return _LazyCollection(name)

    def __getattr__(self, name):
        return getattr(get_db(), name)


db = _LazyDB()


def test_db_connection() -> bool:
    try:
        get_client().admin.command("ping")
        return True
    except Exception:
        return False
