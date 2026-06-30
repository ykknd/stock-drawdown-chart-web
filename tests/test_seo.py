from fastapi.testclient import TestClient

from stock_drawdown_app import create_app


def test_index_includes_seo_tags():
    client = TestClient(create_app())

    response = client.get("/", headers={"host": "example.com"})

    assert response.status_code == 200
    assert "<title>Drawdown Board | 日本株の暴落率・回復度合いを可視化</title>" in response.text
    assert '<meta name="description" content="日本株のドローダウン分析ツール。' in response.text
    assert '<link rel="canonical" href="http://example.com/" />' in response.text
    assert '"@type":"FAQPage"' in response.text
    assert 'property="og:image" content="http://example.com/og-image.svg"' in response.text


def test_robots_txt_includes_sitemap_url():
    client = TestClient(create_app())

    response = client.get("/robots.txt", headers={"host": "example.com"})

    assert response.status_code == 200
    assert response.text == "User-agent: *\nAllow: /\nSitemap: http://example.com/sitemap.xml\n"


def test_sitemap_xml_lists_top_page():
    client = TestClient(create_app())

    response = client.get("/sitemap.xml", headers={"host": "example.com"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/xml")
    assert "<loc>http://example.com/</loc>" in response.text
    assert "<changefreq>daily</changefreq>" in response.text


def test_index_html_redirects_to_top_page():
    client = TestClient(create_app())

    response = client.get("/index.html", follow_redirects=False)

    assert response.status_code == 308
    assert response.headers["location"] == "/"
