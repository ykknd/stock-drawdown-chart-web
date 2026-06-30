from fastapi.testclient import TestClient

from stock_drawdown_app import MemoryPublicAnalysisStore, PublicAnalysisSnapshot, create_app


def test_index_includes_seo_tags():
    client = TestClient(create_app())

    response = client.get("/", headers={"host": "stock-drawdown.com", "x-forwarded-proto": "https"})

    assert response.status_code == 200
    assert "<title>Drawdown Board | 日本株の暴落率・回復度合いを可視化</title>" in response.text
    assert '<meta name="description" content="日本株のドローダウン分析ツール。' in response.text
    assert '<link rel="canonical" href="https://stock-drawdown.com/" />' in response.text
    assert '"@type":"FAQPage"' in response.text
    assert 'property="og:image" content="https://stock-drawdown.com/og-image.svg"' in response.text
    assert '<link rel="manifest" href="/manifest.webmanifest" />' in response.text


def test_robots_txt_includes_sitemap_url():
    client = TestClient(create_app())

    response = client.get("/robots.txt", headers={"host": "stock-drawdown.com", "x-forwarded-proto": "https"})

    assert response.status_code == 200
    assert response.text == "User-agent: *\nAllow: /\nSitemap: https://stock-drawdown.com/sitemap.xml\n"


def test_sitemap_xml_lists_top_page_and_uses_public_analysis_lastmod():
    store = MemoryPublicAnalysisStore()
    store.save(
        "live/latest.json",
        PublicAnalysisSnapshot(
            as_of_date="2026-06-30",
            published_at="2026-07-01T20:00:00+09:00",
            provider="yfinance",
            universe_month="2026-04",
            universe_as_of_date="2026-04-01",
            item_count=0,
            items=[],
        ).model_dump(),
    )
    client = TestClient(create_app(public_analysis_store=store))

    response = client.get("/sitemap.xml", headers={"host": "stock-drawdown.com", "x-forwarded-proto": "https"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert "<loc>https://stock-drawdown.com/</loc>" in response.text
    assert "<lastmod>2026-07-01</lastmod>" in response.text
    assert "<changefreq>daily</changefreq>" in response.text


def test_index_html_redirects_to_top_page():
    client = TestClient(create_app())

    response = client.get("/index.html", follow_redirects=False)

    assert response.status_code == 308
    assert response.headers["location"] == "/"
