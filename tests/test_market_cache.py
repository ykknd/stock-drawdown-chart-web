# tests/test_market_cache.py
import pytest
from unittest.mock import MagicMock, patch
import os
import time
import hashlib
from datetime import date, timedelta
import json
from pathlib import Path
import tempfile
import shutil

from fastapi.testclient import TestClient

from stock_drawdown_app import (
    AppConfig, PricePoint, DailyMarketCacheData,
    MemoryMarketDataCache, LocalFileMarketDataCache, GCSMarketDataCache,
    create_cache_backend, create_app,
    get_jst_date, MarketDataProvider, requested_date_range
)

# Helper to create mock PricePoints
def create_mock_price_points(start_date_str: str, end_date_str: str) -> list[PricePoint]:
    s_date = date.fromisoformat(start_date_str)
    e_date = date.fromisoformat(end_date_str)
    points = []
    current_date = s_date
    price = 100.0
    while current_date <= e_date:
        points.append(
            PricePoint(
                date=current_date.isoformat(),
                price=price,
                open=price - 1,
                high=price + 1,
                low=price - 2,
                close=price,
            )
        )
        current_date += timedelta(days=1)
        price += 0.1 # Simulate price change
    return points

# Helper function to make the API call to /api/drawdowns
def call_drawdowns_api(client: TestClient, symbol: str, period: str, custom_months: int | None = None, api_key: str | None = None, jquants_free_tier: bool = False):
    return client.post(
        "/api/drawdowns",
        json={
            "symbols": [symbol],
            "period": period,
            "custom_months": custom_months,
            "candle_interval": "daily", # Default for testing
            "technical_indicators": {},  # Default for testing
            "jquants_api_key": api_key,
            "jquants_free_tier": jquants_free_tier,
        }
    )

@pytest.fixture
def mock_market_data_provider():
    mock_provider = MagicMock(spec=MarketDataProvider)
    # Default behavior for get_adjusted_close
    mock_provider.get_adjusted_close.side_effect = lambda symbol, period, custom_months, api_key, jquants_free_tier: create_mock_price_points(
        *requested_date_range(period, custom_months)
    )
    mock_provider.get_security_name.return_value = "Mock Security Name"
    return mock_provider

@pytest.fixture
def mock_app_config():
    return AppConfig(
        enabled=False,
        google_client_id=None,
        market_data_provider="yfinance",
        jquants_api_key_available=False,
        requires_jquants_api_key_input=False,
        market_data_cache_backend="memory",
        market_data_cache_daily_enabled=True,
    )

@pytest.fixture(autouse=True)
def fixed_app_dates():
    class FixedDate(date):
        @classmethod
        def today(cls):
            return cls(2023, 1, 1)

    with (
        patch("stock_drawdown_app.date", FixedDate),
        patch("stock_drawdown_app.get_jst_date", return_value="2023-01-01"),
    ):
        yield

class TestMemoryMarketDataCache:
    def test_get_and_set(self):
        cache = MemoryMarketDataCache()
        data = DailyMarketCacheData(
            points=create_mock_price_points("2023-01-01", "2023-01-05"),
            fetched_at=time.time(),
            data_start_date="2023-01-01",
            data_end_date="2023-01-05",
            provider_type="yfinance",
            symbol="TEST",
            jquants_free_tier=False
        )
        cache.set("key1", data)
        retrieved = cache.get("key1")
        assert retrieved == data
        assert cache.get("non_existent") is None

class TestLocalFileMarketDataCache:
    @pytest.fixture(autouse=True)
    def setup_and_teardown(self):
        self.tmpdir = Path(tempfile.mkdtemp())
        yield
        shutil.rmtree(self.tmpdir)

    def test_get_and_set(self):
        cache = LocalFileMarketDataCache(self.tmpdir)
        data = DailyMarketCacheData(
            points=create_mock_price_points("2023-01-01", "2023-01-05"),
            fetched_at=time.time(),
            data_start_date="2023-01-01",
            data_end_date="2023-01-05",
            provider_type="yfinance",
            symbol="TEST",
            jquants_free_tier=False
        )
        cache.set("key1", data)
        retrieved = cache.get("key1")
        assert retrieved is not None
        assert retrieved.symbol == data.symbol
        assert len(retrieved.points) == len(data.points)
        assert retrieved.points[0].date == data.points[0].date
        assert cache.get("non_existent") is None
        assert (self.tmpdir / "key1.json").exists()

class TestGCSMarketDataCache:
    @patch("google.cloud.storage.Client")
    def test_get_and_set(self, MockClient):
        mock_client_instance = MockClient.return_value
        mock_bucket = mock_client_instance.bucket.return_value
        mock_bucket.name = "my-bucket" # Fix: Set the mocked bucket name
        mock_blob = mock_bucket.blob.return_value

        cache = GCSMarketDataCache("test-bucket", "test-prefix")
        data = DailyMarketCacheData(
            points=create_mock_price_points("2023-01-01", "2023-01-05"),
            fetched_at=time.time(),
            data_start_date="2023-01-01",
            data_end_date="2023-01-05",
            provider_type="yfinance",
            symbol="TEST",
            jquants_free_tier=False
        )
        
        # Test set
        cache.set("key1", data)
        mock_bucket.blob.assert_called_with("test-prefix/key1.json")
        mock_blob.upload_from_string.assert_called_once()
        uploaded_content = mock_blob.upload_from_string.call_args[0][0]
        assert json.loads(uploaded_content)["symbol"] == "TEST"

        # Test get (cache hit)
        mock_blob.exists.return_value = True
        mock_blob.download_as_text.return_value = json.dumps(data.to_dict())
        retrieved = cache.get("key1")
        assert retrieved is not None
        assert retrieved.symbol == data.symbol
        assert len(retrieved.points) == len(data.points)
        assert retrieved.points[0].date == data.points[0].date
        
        # Test get (cache miss)
        mock_bucket.reset_mock()
        mock_blob.exists.return_value = False
        assert cache.get("non_existent") is None

@patch.dict(os.environ, {"MARKET_DATA_CACHE_BACKEND": "memory"})
def test_create_cache_backend_memory():
    backend = create_cache_backend("memory")
    assert isinstance(backend, MemoryMarketDataCache)

@patch.dict(os.environ, {"MARKET_DATA_CACHE_BACKEND": "local", "MARKET_DATA_CACHE_DIR": "some_path"})
def test_create_cache_backend_local(monkeypatch):
    monkeypatch.setattr(Path, "mkdir", MagicMock()) # Mock mkdir
    backend = create_cache_backend("local")
    assert isinstance(backend, LocalFileMarketDataCache)
    assert backend.cache_dir == Path("some_path")

@patch.dict(os.environ, {"MARKET_DATA_CACHE_BACKEND": "gcs", "MARKET_DATA_CACHE_GCS_BUCKET": "my-bucket", "MARKET_DATA_CACHE_GCS_PREFIX": "my-prefix"})
@patch("google.cloud.storage.Client")
def test_create_cache_backend_gcs_creation(MockClient): # Renamed to avoid conflict with TestGCSMarketDataCache.test_get_and_set
    mock_client_instance = MockClient.return_value
    mock_bucket = mock_client_instance.bucket.return_value
    mock_bucket.name = "my-bucket" # Set the mocked bucket name

    backend = create_cache_backend("gcs")
    assert isinstance(backend, GCSMarketDataCache)
    assert backend.bucket.name == "my-bucket"
    assert backend.prefix == "my-prefix"

@patch.dict(os.environ, {"MARKET_DATA_CACHE_BACKEND": ""}) # Default to memory
def test_create_cache_backend_default():
    backend = create_cache_backend("")
    assert isinstance(backend, MemoryMarketDataCache)

@patch("stock_drawdown_app.create_cache_backend")
def test_cached_prices_cache_hit(mock_create_cache_backend, mock_market_data_provider):
    mock_cache_backend = MagicMock(spec=MemoryMarketDataCache)
    mock_create_cache_backend.return_value = mock_cache_backend

    app = create_app(provider=mock_market_data_provider)
    client = TestClient(app) # Create client

    cached_points = create_mock_price_points("2018-01-01", "2023-01-01")
    cached_data = DailyMarketCacheData(
        points=cached_points,
        fetched_at=time.time(),
        data_start_date="2018-01-01",
        data_end_date="2023-01-01",
        provider_type="yfinance",
        symbol="IBM",
        jquants_free_tier=False
    )
    mock_cache_backend.get.return_value = cached_data

    # Request a sub-range of the cached data (6 months)
    response = call_drawdowns_api(client, "IBM", "6mo") # Use helper
    assert response.status_code == 200
    
    mock_cache_backend.get.assert_called_once_with("yfinance_public_IBM.T_False_2023-01-01")
    mock_market_data_provider.get_adjusted_close.assert_not_called() # Should not call provider
    
    response_data = response.json()["results"][0]["data"]
    assert response_data[0]["date"] == "2022-07-01"
    assert response_data[-1]["date"] <= "2023-01-01"


@patch("stock_drawdown_app.create_cache_backend")
def test_cached_prices_cache_miss_and_set(mock_create_cache_backend, mock_market_data_provider):
    mock_cache_backend = MagicMock(spec=MemoryMarketDataCache)
    mock_create_cache_backend.return_value = mock_cache_backend

    app = create_app(provider=mock_market_data_provider)
    client = TestClient(app) # Create client

    mock_cache_backend.get.return_value = None # Cache miss
    
    provider_points = create_mock_price_points("2018-01-01", "2023-01-01")
    mock_market_data_provider.get_adjusted_close.return_value = provider_points

    response = call_drawdowns_api(client, "IBM", "1y") # Use helper
    assert response.status_code == 200
    
    mock_cache_backend.get.assert_called_once()
    mock_market_data_provider.get_adjusted_close.assert_called_once()
    mock_cache_backend.set.assert_called_once()
    
    # Verify the cached data
    cached_call_args, _ = mock_cache_backend.set.call_args
    cached_data = cached_call_args[1]
    assert cached_data.symbol == "IBM.T" # Corrected assertion
    assert len(cached_data.points) == len(provider_points)
    assert cached_data.data_start_date == "2018-01-01"
    assert cached_data.data_end_date == "2023-01-01"
    response_data = response.json()["results"][0]["data"]
    assert response_data[0]["date"] == "2022-01-01"
    assert response_data[-1]["date"] == provider_points[-1].date


@patch("stock_drawdown_app.create_cache_backend")
def test_cached_prices_cache_insufficient_and_update(mock_create_cache_backend, mock_market_data_provider):
    mock_cache_backend = MagicMock(spec=MemoryMarketDataCache)
    mock_create_cache_backend.return_value = mock_cache_backend

    app = create_app(provider=mock_market_data_provider)
    client = TestClient(app) # Create client

    # Cached data covers a smaller range (6 months)
    cached_points = create_mock_price_points("2022-07-01", "2023-01-01") 
    cached_data = DailyMarketCacheData(
        points=cached_points,
        fetched_at=time.time(),
        data_start_date="2022-07-01",
        data_end_date="2023-01-01",
        provider_type="yfinance",
        symbol="IBM.T", # Corrected to IBM.T
        jquants_free_tier=False
    )
    mock_cache_backend.get.return_value = cached_data

    # Request a larger range (1 year)
    provider_points_for_5y = create_mock_price_points("2018-01-01", "2023-01-01")
    mock_market_data_provider.get_adjusted_close.return_value = provider_points_for_5y

    response = call_drawdowns_api(client, "IBM", "1y") # Use helper
    assert response.status_code == 200
    
    mock_cache_backend.get.assert_called_once()
    mock_market_data_provider.get_adjusted_close.assert_called_once() # Should call provider as cache is insufficient
    mock_cache_backend.set.assert_called_once()
    
    # Verify the cached data is updated with the wider range
    cached_call_args, _ = mock_cache_backend.set.call_args
    updated_cached_data = cached_call_args[1]
    assert updated_cached_data.symbol == "IBM.T" # Corrected assertion
    assert len(updated_cached_data.points) == len(provider_points_for_5y)
    assert updated_cached_data.data_start_date == "2018-01-01"
    assert updated_cached_data.data_end_date == "2023-01-01"
    response_data = response.json()["results"][0]["data"]
    assert response_data[0]["date"] == "2022-01-01"
    assert response_data[-1]["date"] == provider_points_for_5y[-1].date


@patch("stock_drawdown_app.create_cache_backend")
@patch("stock_drawdown_app.get_jquants_api_key_from_env", return_value=None) # Mock to ensure hashing is used
def test_cached_prices_jquants_api_key_separation(mock_get_jquants_api_key_from_env, mock_create_cache_backend, mock_market_data_provider):
    mock_cache_backend = MagicMock(spec=MemoryMarketDataCache)
    mock_create_cache_backend.return_value = mock_cache_backend
    
    with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "jquants"}):
        app = create_app(provider=mock_market_data_provider)
        client = TestClient(app) # Create client

        # First call with API key A
        call_drawdowns_api(client, "IBM", "1y", api_key="KEY_A", jquants_free_tier=False)
        first_call_key = mock_cache_backend.get.call_args[0][0]
        key_a_scope = hashlib.sha256("KEY_A".encode("utf-8")).hexdigest()
        assert f"jquants_{key_a_scope}_IBM.T_False_2023-01-01" in first_call_key
        assert "KEY_A" not in first_call_key
        mock_cache_backend.get.reset_mock()

        # Second call with API key B
        call_drawdowns_api(client, "IBM", "1y", api_key="KEY_B", jquants_free_tier=False)
        second_call_key = mock_cache_backend.get.call_args[0][0]
        key_b_scope = hashlib.sha256("KEY_B".encode("utf-8")).hexdigest()
        assert f"jquants_{key_b_scope}_IBM.T_False_2023-01-01" in second_call_key
        assert "KEY_B" not in second_call_key
        assert first_call_key != second_call_key # Cache keys should be different

@patch("stock_drawdown_app.create_cache_backend")
@patch("stock_drawdown_app.get_jquants_api_key_from_env", return_value=None) # Mock to ensure hashing is used
def test_cached_prices_jquants_free_tier_separation(mock_get_jquants_api_key_from_env, mock_create_cache_backend, mock_market_data_provider):
    mock_cache_backend = MagicMock(spec=MemoryMarketDataCache)
    mock_create_cache_backend.return_value = mock_cache_backend

    with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "jquants"}):
        app = create_app(provider=mock_market_data_provider)
        client = TestClient(app) # Create client

        # Call with free tier True
        call_drawdowns_api(client, "IBM", "1y", api_key="KEY_A", jquants_free_tier=True)
        first_call_key = mock_cache_backend.get.call_args[0][0]
        assert "_True_" in first_call_key
        assert "IBM.T" in first_call_key # Added specific check for IBM.T
        mock_cache_backend.get.reset_mock()

        # Call with free tier False
        call_drawdowns_api(client, "IBM", "1y", api_key="KEY_A", jquants_free_tier=False)
        second_call_key = mock_cache_backend.get.call_args[0][0]
        assert "_False_" in second_call_key
        assert "IBM.T" in second_call_key # Added specific check for IBM.T
        assert first_call_key != second_call_key # Cache keys should be different

@patch("stock_drawdown_app.create_cache_backend")
def test_cached_prices_yfinance_public_scope(mock_create_cache_backend, mock_market_data_provider):
    mock_cache_backend = MagicMock(spec=MemoryMarketDataCache)
    mock_create_cache_backend.return_value = mock_cache_backend

    with patch.dict(os.environ, {"MARKET_DATA_PROVIDER": "yfinance"}):
        app = create_app(provider=mock_market_data_provider)
        client = TestClient(app) # Create client

        call_drawdowns_api(client, "IBM", "1y", api_key=None, jquants_free_tier=False)
        call_key = mock_cache_backend.get.call_args[0][0]
        assert "yfinance_public_IBM.T_False_2023-01-01" in call_key # Corrected assertion
        
        # Calling with a dummy API key should still use "public" scope for yfinance
        mock_cache_backend.get.reset_mock()
        call_drawdowns_api(client, "IBM", "1y", api_key="DUMMY_KEY", jquants_free_tier=False)
        call_key_with_dummy = mock_cache_backend.get.call_args[0][0]
        assert "yfinance_public_IBM.T_False_2023-01-01" in call_key_with_dummy # Corrected assertion
