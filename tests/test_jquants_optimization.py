import pytest
from stock_drawdown_app import JQuantsMarketDataProvider, PricePoint
import requests
from unittest.mock import MagicMock, patch

class MockResponse:
    def __init__(self, status_code):
        self.status_code = status_code

def test_jquants_only_uses_5_digit_code():
    provider = JQuantsMarketDataProvider()
    with patch("jquantsapi.ClientV2") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        mock_client.get_eq_bars_daily.return_value = MagicMock(empty=False)
        
        # 7203 should be converted to 72030
        try:
            provider.get_adjusted_close("7203", period="1y")
        except Exception:
            pass
        
        mock_client.get_eq_bars_daily.assert_called_once()
        args, kwargs = mock_client.get_eq_bars_daily.call_args
        assert kwargs["code"] == "72030"

def test_jquants_error_handling_429():
    provider = JQuantsMarketDataProvider()
    with patch("jquantsapi.ClientV2") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        response = MockResponse(429)
        mock_client.get_eq_bars_daily.side_effect = requests.exceptions.HTTPError(response=response)
        
        with pytest.raises(ValueError, match="J-Quants APIのレート制限に達しました。時間を置いて再試行してください。"):
            provider.get_adjusted_close("7203", period="1y")

def test_jquants_error_handling_403():
    provider = JQuantsMarketDataProvider()
    with patch("jquantsapi.ClientV2") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        response = MockResponse(403)
        mock_client.get_eq_bars_daily.side_effect = requests.exceptions.HTTPError(response=response)
        
        with pytest.raises(ValueError, match="J-Quants APIの契約プランで制限されているか、無効なAPIキーです。"):
            provider.get_adjusted_close("7203", period="1y")

def test_jquants_error_handling_retry_error():
    from tenacity import RetryError
    provider = JQuantsMarketDataProvider()
    with patch("jquantsapi.ClientV2") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        # tenacity.RetryError(last_attempt) where last_attempt.result() raised something or just message
        # For simplicity, we can mock RetryError directly if we want to check the mapping
        # but RetryError is usually initialized with a Future.
        # Here we check if our code catches the type and maps it.
        mock_client.get_eq_bars_daily.side_effect = RetryError(MagicMock())
        
        with pytest.raises(ValueError, match="J-Quants APIのレート制限に達しました。時間を置いて再試行してください。"):
            provider.get_adjusted_close("7203", period="1y")

def test_jquants_error_handling_rate_limit_string():
    provider = JQuantsMarketDataProvider()
    with patch("jquantsapi.ClientV2") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        mock_client.get_eq_bars_daily.side_effect = Exception("too many 429 error responses")
        
        with pytest.raises(ValueError, match="J-Quants APIのレート制限に達しました。時間を置いて再試行してください。"):
            provider.get_adjusted_close("7203", period="1y")

def test_jquants_error_handling_subscription_400():
    provider = JQuantsMarketDataProvider()
    with patch("jquantsapi.ClientV2") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        response = MockResponse(400)
        mock_client.get_eq_bars_daily.side_effect = requests.exceptions.HTTPError(response=response)
        
        with pytest.raises(ValueError, match="J-Quantsの契約範囲外の期間です。期間または無料枠設定を確認してください。"):
            provider.get_adjusted_close("7203", period="1y")

def test_jquants_error_handling_subscription_string():
    provider = JQuantsMarketDataProvider()
    with patch("jquantsapi.ClientV2") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        mock_client.get_eq_bars_daily.side_effect = Exception("only covers the following dates")
        
        with pytest.raises(ValueError, match="J-Quantsの契約範囲外の期間です。期間または無料枠設定を確認してください。"):
            provider.get_adjusted_close("7203", period="1y")

def test_jquants_no_retry_on_failure():
    provider = JQuantsMarketDataProvider()
    with patch("jquantsapi.ClientV2") as mock_client_class:
        mock_client = MagicMock()
        mock_client_class.return_value = mock_client
        
        mock_client.get_eq_bars_daily.side_effect = Exception("Some error")
        
        with pytest.raises(ValueError, match="J-Quantsからのデータ取得に失敗しました"):
            provider.get_adjusted_close("7203", period="1y")
        
        # Only 1 call should be made (no retry)
        assert mock_client.get_eq_bars_daily.call_count == 1
