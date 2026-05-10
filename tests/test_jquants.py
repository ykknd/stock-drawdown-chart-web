import os
import hashlib
from fastapi.testclient import TestClient
import pytest
from stock_drawdown_app import (
    create_app,
    normalize_market_data_provider,
    JQuantsMarketDataProvider,
    hash_api_key,
    PricePoint
)

def test_normalize_market_data_provider():
    assert normalize_market_data_provider(None) == "yfinance"
    assert normalize_market_data_provider("") == "yfinance"
    assert normalize_market_data_provider("YFINANCE") == "yfinance"
    assert normalize_market_data_provider("jquants") == "jquants"
    with pytest.raises(ValueError, match="サポートされていない MARKET_DATA_PROVIDER です"):
        normalize_market_data_provider("unknown")

def test_jquants_code_conversion():
    provider = JQuantsMarketDataProvider()
    assert provider._to_jquants_code("7203") == "72030"
    assert provider._to_jquants_code("7203.T") == "72030"
    assert provider._to_jquants_code("72030") == "72030"
    with pytest.raises(ValueError, match="J-Quantsでは対応していない銘柄形式です"):
        provider._to_jquants_code("^N225")

def test_hash_api_key():
    key = "secret-key"
    expected = hashlib.sha256(key.encode()).hexdigest()
    assert hash_api_key(key) == expected

class MockJQuantsProvider:
    def get_adjusted_close(self, symbol, period, custom_months=None, api_key=None):
        self.last_api_key = api_key
        return [PricePoint("2026-01-01", 100.0)]
    
    def get_security_name(self, symbol, api_key=None):
        return "Mock Name"

def test_jquants_api_key_resolution(monkeypatch):
    provider = MockJQuantsProvider()
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "jquants")
    monkeypatch.delenv("JQUANTS_API_KEY", raising=False)
    
    client = TestClient(create_app(provider))
    
    # 1. No key -> 400
    response = client.post("/api/drawdowns", json={"symbols": ["7203"]})
    assert response.status_code == 400
    assert "J-Quants APIキーが必要です" in response.json()["detail"]
    
    # 2. Request key
    response = client.post("/api/drawdowns", json={"symbols": ["7203"], "jquants_api_key": "req-key"})
    assert response.status_code == 200
    assert provider.last_api_key == "req-key"
    
    # 3. Server key (monkeypatch)
    monkeypatch.setenv("JQUANTS_API_KEY", "srv-key")
    response = client.post("/api/drawdowns", json={"symbols": ["7203"]})
    assert response.status_code == 200
    assert provider.last_api_key == "srv-key"
    
    # 4. Server key overrides request key
    response = client.post("/api/drawdowns", json={"symbols": ["7203"], "jquants_api_key": "req-key-2"})
    assert response.status_code == 200
    assert provider.last_api_key == "srv-key"

def test_api_config_jquants(monkeypatch):
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "jquants")
    monkeypatch.delenv("JQUANTS_API_KEY", raising=False)
    
    client = TestClient(create_app(MockJQuantsProvider()))
    
    # No server key
    response = client.get("/api/config")
    payload = response.json()
    assert payload["market_data_provider"] == "jquants"
    assert payload["jquants_api_key_available"] is False
    assert payload["requires_jquants_api_key_input"] is True
    
    # With server key
    monkeypatch.setenv("JQUANTS_API_KEY", "srv-key")
    response = client.get("/api/config")
    payload = response.json()
    assert payload["jquants_api_key_available"] is True
    assert payload["requires_jquants_api_key_input"] is False

def test_api_key_leak_prevention(monkeypatch):
    provider = MockJQuantsProvider()
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "jquants")
    monkeypatch.setenv("JQUANTS_API_KEY", "srv-key")
    
    client = TestClient(create_app(provider))
    
    # Config should not leak key
    response = client.get("/api/config")
    assert "srv-key" not in response.text
    
    # Error response should not leak key
    def raise_error(*args, **kwargs):
        raise ValueError("Error with srv-key inside")
    provider.get_adjusted_close = raise_error
    
    response = client.post("/api/drawdowns", json={"symbols": ["7203"]})
    assert "srv-key" not in response.text
    assert "データ取得エラーが発生しました" in response.text
