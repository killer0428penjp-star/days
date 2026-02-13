// ==========================================
// 天気・気温・湿度を取得する処理 (Open-Meteo API使用)
// ==========================================

async function initWeather() {
    const weatherText = document.getElementById('weather-text');
    const tempText = document.getElementById('temp');
    const humidityText = document.getElementById('humidity');

    // 位置情報の取得（許可されない場合は東京をデフォルトにする）
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                fetchWeatherData(lat, lon);
            },
            (error) => {
                console.warn("位置情報の取得に失敗しました。デフォルト(東京)の天気を表示します。", error);
                // デフォルト：東京の座標
                fetchWeatherData(35.6895, 139.6917);
            }
        );
    } else {
        // Geolocation非対応ブラウザの場合
        fetchWeatherData(35.6895, 139.6917);
    }

    async function fetchWeatherData(lat, lon) {
        try {
            // Open-Meteo API URL (現在の天気、気温、湿度を取得)
            const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.current) {
                // 気温の更新
                tempText.textContent = data.current.temperature_2m;
                
                // 湿度の更新
                humidityText.textContent = data.current.relative_humidity_2m;

                // 天気コードを文字に変換
                const code = data.current.weather_code;
                weatherText.textContent = getWeatherDescription(code);
            }
        } catch (err) {
            console.error("天気情報の取得エラー:", err);
            weatherText.textContent = "Err";
        }
    }

    // WMO天気コードを日本語に変換するヘルパー関数
    function getWeatherDescription(code) {
        // 0: 快晴, 1-3: 晴れ/曇り, 45-48: 霧
        // 51-55: 霧雨, 61-65: 雨, 71-77: 雪, 80-82: にわか雨, 95-99: 雷雨
        if (code === 0) return "快晴";
        if (code >= 1 && code <= 3) return "晴れ/曇り";
        if (code >= 45 && code <= 48) return "霧";
        if (code >= 51 && code <= 55) return "霧雨";
        if (code >= 61 && code <= 67) return "雨";
        if (code >= 71 && code <= 77) return "雪";
        if (code >= 80 && code <= 82) return "にわか雨";
        if (code >= 85 && code <= 86) return "雪";
        if (code >= 95 && code <= 99) return "雷雨";
        return "不明";
    }
}

// ページ読み込み時に実行
document.addEventListener('DOMContentLoaded', initWeather);