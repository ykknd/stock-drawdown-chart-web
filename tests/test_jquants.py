import os
import hashlib
from fastapi.testclient import TestClient
import pytest
from stock_drawdown_app import (
    create_app,
    normalize_market_data_provider,
    JQuantsMarketDataProvider,
    get_local_security_name,
    hash_api_key,
    jquants_request_interval_seconds,
    normalize_date_value,
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
    assert provider._to_jquants_base_code("7203") == "7203"
    assert provider._to_jquants_base_code("7203.T") == "7203"
    assert provider._to_jquants_base_code("72030") == "7203"
    assert provider._to_jquants_code("7203") == "72030"
    assert provider._to_jquants_code("7203.T") == "72030"
    assert provider._to_jquants_code("72030") == "72030"
    assert provider._jquants_code_candidates("9432") == ["94320", "9432"]
    with pytest.raises(ValueError, match="J-Quantsでは対応していない銘柄形式です"):
        provider._to_jquants_code("^N225")

def test_jquants_security_name_uses_v2_columns():
    provider = JQuantsMarketDataProvider()
    assert provider._extract_security_name({"CoName": "トヨタ自動車", "CompanyName": ""}) == "トヨタ自動車"
    assert provider._extract_security_name({"CoName": "", "CoNameEn": "TOYOTA MOTOR CORPORATION"}) == "TOYOTA MOTOR CORPORATION"

def test_local_security_name_fallback():
    assert get_local_security_name("6758") == "ソニーグループ"
    assert get_local_security_name("9432.T") == "日本電信電話"
    assert get_local_security_name("8306") == "三菱ＵＦＪフィナンシャル・グループ"
    assert get_local_security_name("8316") == "三井住友フィナンシャルグループ"

def test_hash_api_key():
    key = "secret-key"
    expected = hashlib.sha256(key.encode()).hexdigest()
    assert hash_api_key(key) == expected

def test_jquants_request_interval_seconds(monkeypatch):
    monkeypatch.delenv("JQUANTS_REQUEST_INTERVAL_SECONDS", raising=False)
    assert jquants_request_interval_seconds() == 1.0

    monkeypatch.setenv("JQUANTS_REQUEST_INTERVAL_SECONDS", "0.25")
    assert jquants_request_interval_seconds() == 0.25

    monkeypatch.setenv("JQUANTS_REQUEST_INTERVAL_SECONDS", "invalid")
    assert jquants_request_interval_seconds() == 1.0

def test_normalize_date_value_accepts_jquants_datetime_string():
    assert normalize_date_value("2025-07-01 00:00:00") == "2025-07-01"
    assert normalize_date_value("20250701") == "2025-07-01"

class MockJQuantsProvider:
    def __init__(self):
        self.name_calls = 0

    def get_adjusted_close(self, symbol, period, custom_months=None, api_key=None):
        self.last_api_key = api_key
        return [PricePoint("2026-01-01", 100.0)]
    
    def get_security_name(self, symbol, api_key=None):
        self.name_calls += 1
        return "Mock Name"

class MockMissingNameProvider(MockJQuantsProvider):
    def get_security_name(self, symbol, api_key=None):
        self.name_calls += 1
        return None

def test_missing_security_name_is_not_cached(monkeypatch):
    provider = MockMissingNameProvider()
    monkeypatch.setenv("MARKET_DATA_PROVIDER", "jquants")
    monkeypatch.setenv("JQUANTS_API_KEY", "srv-key")

    client = TestClient(create_app(provider))

    for _ in range(2):
        response = client.post("/api/drawdowns", json={"symbols": ["6758"]})
        assert response.status_code == 200

    assert provider.name_calls == 2

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
