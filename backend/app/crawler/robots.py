"""robots.txt parsing and caching manager."""

import logging
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger(__name__)


class RobotsChecker:
    """Asynchronous robots.txt checker with domain caching."""

    def __init__(self, user_agent: str = "WebAtlas/0.1.0", timeout: float = 5.0):
        self.user_agent = user_agent
        self.timeout = timeout
        self._cache: dict[str, RobotFileParser | None] = {}

    async def get_parser(self, url: str, client: httpx.AsyncClient | None = None) -> RobotFileParser | None:
        """Fetch and parse robots.txt for the given URL's origin domain."""
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"

        if origin in self._cache:
            return self._cache[origin]

        robots_url = f"{origin}/robots.txt"
        rfp = RobotFileParser()
        rfp.set_url(robots_url)

        try:
            logger.info("Fetching robots.txt from %s", robots_url)
            if client is not None:
                response = await client.get(robots_url, timeout=self.timeout, follow_redirects=True)
            else:
                async with httpx.AsyncClient(headers={"User-Agent": self.user_agent}) as temp_client:
                    response = await temp_client.get(robots_url, timeout=self.timeout, follow_redirects=True)

            if response.status_code == 200:
                rfp.parse(response.text.splitlines())
                self._cache[origin] = rfp
                return rfp
            elif response.status_code in (401, 403):
                # Disallow all if access to robots.txt is forbidden
                rfp.parse(["User-agent: *", "Disallow: /"])
                self._cache[origin] = rfp
                return rfp
            else:
                # 404 or other statuses: default to allow all
                rfp.parse(["User-agent: *", "Disallow:"])
                self._cache[origin] = rfp
                return rfp

        except Exception as err:
            logger.warning("Could not fetch robots.txt from %s (%s). Defaulting to ALLOW.", robots_url, err)
            rfp.parse(["User-agent: *", "Disallow:"])
            self._cache[origin] = rfp
            return rfp

    async def is_allowed(self, url: str, client: httpx.AsyncClient | None = None) -> bool:
        """Check if crawling the specified URL is allowed by robots.txt."""
        try:
            parser = await self.get_parser(url, client)
            if parser is None:
                return True

            # Check for specific user agent first, then wildcard '*'
            allowed_specific = parser.can_fetch(self.user_agent, url)
            allowed_wildcard = parser.can_fetch("*", url)

            return allowed_specific and allowed_wildcard
        except Exception as err:
            logger.warning("Error checking robots.txt for %s: %s. Defaulting to ALLOW.", url, err)
            return True
