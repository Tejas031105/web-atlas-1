"""Browser-based rendering service using Playwright Chromium for WebAtlas."""

import asyncio
import time
import logging
from typing import Optional
from playwright.async_api import async_playwright, Playwright, Browser, BrowserContext, Page, TimeoutError as PlaywrightTimeoutError

from app.core.config import settings
from app.crawler.fetcher import FetchResult
from app.crawler.exceptions import FetchError
from app.crawler.url_utils import is_crawlable_scheme, normalize_url

logger = logging.getLogger("webatlas.crawler.browser")


class BrowserRenderer:
    """Browser rendering service executing JavaScript via Playwright Chromium."""

    def __init__(
        self,
        headless: Optional[bool] = None,
        timeout: Optional[float] = None,
        user_agent: Optional[str] = None,
        wait_until: Optional[str] = None,
    ):
        self.headless = settings.PLAYWRIGHT_HEADLESS if headless is None else headless
        self.timeout = settings.PLAYWRIGHT_TIMEOUT if timeout is None else timeout
        self.user_agent = user_agent or "WebAtlas/0.1.0"
        self.wait_until = wait_until or settings.PLAYWRIGHT_WAIT_UNTIL

        self._playwright: Optional[Playwright] = None
        self._browser: Optional[Browser] = None

    async def __aenter__(self):
        """Initialize Playwright and launch Chromium browser instance."""
        try:
            if not self._playwright:
                self._playwright = await async_playwright().start()
            if not self._browser:
                self._browser = await self._playwright.chromium.launch(
                    headless=self.headless,
                    args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
                )
            logger.info("Playwright Chromium browser launched successfully (headless=%s)", self.headless)
            return self
        except Exception as err:
            await self.close()
            logger.error("Failed to launch Playwright browser: %s", err)
            raise FetchError(f"Browser launch failed: {err}") from err

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Clean up and close browser resources safely."""
        await self.close()

    async def close(self) -> None:
        """Close browser and stop Playwright process gracefully."""
        if self._browser:
            try:
                await self._browser.close()
            except Exception as err:
                logger.warning("Error closing Playwright browser: %s", err)
            finally:
                self._browser = None

        if self._playwright:
            try:
                await self._playwright.stop()
            except Exception as err:
                logger.warning("Error stopping Playwright instance: %s", err)
            finally:
                self._playwright = None

    async def render(
        self,
        url: str,
        timeout: Optional[float] = None,
        user_agent: Optional[str] = None,
        wait_until: Optional[str] = None,
    ) -> FetchResult:
        """Navigate to URL in Chromium, execute JavaScript, and return rendered DOM FetchResult."""
        norm_url = normalize_url(url)
        if not is_crawlable_scheme(norm_url):
            raise FetchError(f"Invalid or unsupported URL scheme: {url}", url=url)

        eff_timeout = timeout if timeout is not None else self.timeout
        eff_user_agent = user_agent or self.user_agent
        eff_wait_until = wait_until or self.wait_until
        timeout_ms = int(eff_timeout * 1000)

        auto_opened_browser = False
        if not self._browser:
            await self.__aenter__()
            auto_opened_browser = True

        context: Optional[BrowserContext] = None
        page: Optional[Page] = None
        start_time = time.perf_counter()

        try:
            logger.info("Rendering URL with Playwright: %s (timeout=%.1fs)", norm_url, eff_timeout)
            context = await self._browser.new_context(
                user_agent=eff_user_agent,
                viewport={"width": 1280, "height": 800},
                bypass_csp=True,
            )
            page = await context.new_page()
            page.set_default_navigation_timeout(timeout_ms)
            page.set_default_timeout(timeout_ms)

            response = await asyncio.wait_for(
                page.goto(
                    norm_url,
                    timeout=timeout_ms,
                    wait_until=eff_wait_until,
                ),
                timeout=eff_timeout + 5.0,
            )

            elapsed_time = round(time.perf_counter() - start_time, 4)
            final_url = page.url
            status_code = response.status if response else 200

            headers = response.headers if response else {}
            content_type_header = headers.get("content-type", "text/html").lower()
            content_type = content_type_header.split(";")[0].strip() if content_type_header else "text/html"

            # Capture fully rendered HTML DOM content after JavaScript execution
            html_content = await asyncio.wait_for(page.content(), timeout=10.0)

            logger.info(
                "Rendered [%d] %s in %.4fs (HTML length: %d bytes)",
                status_code,
                final_url,
                elapsed_time,
                len(html_content),
            )

            return FetchResult(
                url=url,
                final_url=final_url,
                status_code=status_code,
                content_type=content_type,
                html_content=html_content,
                response_time=elapsed_time,
                is_html=True,
            )

        except (PlaywrightTimeoutError, asyncio.TimeoutError) as exc:
            elapsed = round(time.perf_counter() - start_time, 4)
            logger.warning("Playwright navigation timeout for %s after %.1fs", url, eff_timeout)
            raise FetchError(f"Playwright navigation timeout after {eff_timeout}s: {exc}", url=url) from exc
        except Exception as exc:
            elapsed = round(time.perf_counter() - start_time, 4)
            logger.error("Playwright rendering error for %s: %s", url, exc)
            raise FetchError(f"Playwright rendering error: {exc}", url=url) from exc
        finally:
            if page:
                try:
                    await page.close()
                except Exception:
                    pass
            if context:
                try:
                    await context.close()
                except Exception:
                    pass
            if auto_opened_browser:
                await self.close()
