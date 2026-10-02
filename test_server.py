import json
import io
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from http.server import ThreadingHTTPServer
from unittest.mock import patch

import server as jarvis


class JarvisTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        cls.previous_db = jarvis.DB_PATH
        cls.previous_cache = jarvis.TTS_CACHE
        cls.previous_music = jarvis.MUSIC_PATH
        cls.previous_key = jarvis.KEY_PATH
        jarvis.DB_PATH = Path(cls.temp.name) / "jarvis.sqlite3"
        jarvis.TTS_CACHE = Path(cls.temp.name) / "tts-cache"
        jarvis.MUSIC_PATH = Path(cls.temp.name) / "intro.mp3"
        jarvis.KEY_PATH = Path(cls.temp.name) / "openai.key"
        cls.http = ThreadingHTTPServer(("127.0.0.1", 0), jarvis.Handler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = f"http://127.0.0.1:{cls.http.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join(timeout=5)
        jarvis.DB_PATH = cls.previous_db
        jarvis.TTS_CACHE = cls.previous_cache
        jarvis.MUSIC_PATH = cls.previous_music
        jarvis.KEY_PATH = cls.previous_key
        cls.temp.cleanup()

    def request(self, path, method="GET", payload=None):
        body = json.dumps(payload).encode() if payload is not None else None
        request = urllib.request.Request(self.base + path, data=body, method=method)
        if body is not None:
            request.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(request, timeout=5) as response:
            return response.status, json.load(response)

    def test_automatic_archive_and_recall(self):
        status, first = self.request("/api/chat", "POST", {"message": "Il mio colore preferito è blu", "address": "Signore"})
        self.assertEqual(status, 200)
        self.assertEqual(first["history_count"], 1)
        self.assertEqual(first["history"][0]["text"], "Il mio colore preferito è blu")
        _, reply = self.request("/api/chat", "POST", {"message": "Cosa ti ho detto su colore?", "address": "Signore"})
        self.assertTrue(reply["reply"].startswith("Signore,"))
        self.assertIn("Il mio colore preferito è blu", reply["reply"])
        _, state = self.request("/api/state")
        self.assertEqual(state["history_count"], 2)
        self.assertEqual(len(state["messages"]), 4)
        self.assertEqual(state["voice_identity"], "Sperimentale")
        _, history = self.request("/api/history?query=blu")
        self.assertEqual(history["history"][0]["text"], "Il mio colore preferito è blu")

    def test_invalid_message_rejected(self):
        request = urllib.request.Request(
            self.base + "/api/chat", data=json.dumps({"message": ""}).encode(),
            method="POST", headers={"Content-Type": "application/json"}
        )
        with self.assertRaises(urllib.error.HTTPError) as result:
            urllib.request.urlopen(request, timeout=5)
        self.assertEqual(result.exception.code, 400)

    def test_voice_script_served(self):
        for path, symbol in [("/voice.js", b"JarvisVoiceGate"), ("/browser-store.js", b"JarvisBrowserStore"), ("/neurons-3d.js", b"JarvisNeural3D"), ("/boot.js", b"JarvisBoot")]:
            with urllib.request.urlopen(self.base + path, timeout=5) as response:
                self.assertEqual(response.status, 200)
                self.assertIn(symbol, response.read())

    def test_mac_launch_prefers_installed_chrome(self):
        with patch.object(jarvis.sys, "platform", "darwin"), patch.object(jarvis.Path, "exists", return_value=True), \
             patch.object(jarvis.subprocess, "Popen") as chrome, patch.object(jarvis.webbrowser, "open") as default:
            jarvis.open_interface()
            self.assertEqual(chrome.call_args.args[0], ["open", "-a", "Google Chrome", "http://127.0.0.1:8765"])
            default.assert_not_called()

    def test_speech_requires_key_and_valid_text(self):
        with patch.dict(jarvis.os.environ, {"OPENAI_API_KEY": ""}):
            request = urllib.request.Request(
                self.base + "/api/speech", data=json.dumps({"text": "Buongiorno, Signore."}).encode(),
                method="POST", headers={"Content-Type": "application/json"}
            )
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request, timeout=5)
            self.assertEqual(error.exception.code, 503)

    def test_speech_returns_audio_without_exposing_key(self):
        with patch.object(jarvis, "natural_speech", return_value=b"mock-mp3") as speech:
            request = urllib.request.Request(
                self.base + "/api/speech", data=json.dumps({"text": "Buongiorno, Signore."}).encode(),
                method="POST", headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(request, timeout=5) as response:
                self.assertEqual(response.headers.get_content_type(), "audio/mpeg")
                self.assertEqual(response.read(), b"mock-mp3")
            speech.assert_called_once_with("Buongiorno, Signore.")

    def test_greeting_follows_the_hour(self):
        self.assertEqual(jarvis.greeting(7), "Buongiorno")
        self.assertEqual(jarvis.greeting(14), "Buon pomeriggio")
        self.assertEqual(jarvis.greeting(21), "Buonasera")
        self.assertEqual(jarvis.greeting(3), "Buonanotte")

    def test_weather_from_coordinates_and_city(self):
        forecast = {"current": {"temperature_2m": 17.6, "weather_code": 61, "precipitation": 0.4},
                    "daily": {"weather_code": [63], "precipitation_probability_max": [75], "temperature_2m_max": [19.2], "temperature_2m_min": [11.8]}}
        places = {"results": [{"name": "Milano", "latitude": 45.46, "longitude": 9.19}]}
        jarvis.WEATHER_CACHE.clear()
        with patch.object(jarvis, "fetch_json", side_effect=[forecast]) as fetch:
            status, data = self.request("/api/weather?lat=45.46&lon=9.19")
            self.assertEqual(status, 200)
            self.assertEqual(data["temperature"], 18)
            self.assertTrue(data["rain_expected"])
            self.assertEqual(data["rain_probability"], 75)
            self.assertEqual(data["description"], "pioggia leggera")
            self.assertEqual(data["day_description"], "pioggia")
            self.assertFalse(data["nice_day"])
            self.assertIn("latitude=45.46", fetch.call_args.args[0])
            self.request("/api/weather?lat=45.46&lon=9.19")
            fetch.assert_called_once()
        jarvis.WEATHER_CACHE.clear()
        sunny = {"current": {"temperature_2m": 24.2, "weather_code": 0}, "daily": {"weather_code": [1], "precipitation_probability_max": [5], "temperature_2m_max": [27], "temperature_2m_min": [15]}}
        with patch.object(jarvis, "fetch_json", side_effect=[places, sunny]) as fetch:
            _, data = self.request("/api/weather?city=Milano")
            self.assertEqual(data["place"], "Milano")
            self.assertTrue(data["nice_day"])
            self.assertIn("name=Milano", fetch.call_args_list[0].args[0])
        with patch.object(jarvis, "fetch_json", side_effect=[{"results": []}]), self.assertRaises(urllib.error.HTTPError) as missing:
            self.request("/api/weather?city=Nessunluogo")
        self.assertEqual(missing.exception.code, 404)
        with patch.dict(jarvis.os.environ, {"JARVIS_CITY": ""}), self.assertRaises(urllib.error.HTTPError) as unknown:
            self.request("/api/weather")
        self.assertEqual(unknown.exception.code, 404)

    def test_api_key_comes_from_environment_or_local_file(self):
        with patch.dict(jarvis.os.environ, {"OPENAI_API_KEY": ""}):
            self.assertEqual(jarvis.api_key(), "")
            jarvis.KEY_PATH.write_text("sk-dal-file\n")
            try:
                self.assertEqual(jarvis.api_key(), "sk-dal-file")
                _, state = self.request("/api/state")
                self.assertEqual(state["mode"], "AI online")
                self.assertTrue(state["natural_voice"])
            finally:
                jarvis.KEY_PATH.unlink()
        with patch.dict(jarvis.os.environ, {"OPENAI_API_KEY": "sk-ambiente"}):
            self.assertEqual(jarvis.api_key(), "sk-ambiente")

    def test_speech_is_cached_by_text(self):
        with patch.object(jarvis, "natural_speech", return_value=b"cached-mp3") as speech:
            self.assertEqual(jarvis.speech_audio("Battuta da conservare."), b"cached-mp3")
            self.assertEqual(jarvis.speech_audio("Battuta da conservare."), b"cached-mp3")
            speech.assert_called_once()
        self.assertTrue(jarvis.speech_cache_path("Battuta da conservare.").is_file())

    def test_brain_status_counts_real_systems_with_minimums(self):
        with patch.dict(jarvis.os.environ, {"OPENAI_API_KEY": ""}):
            status, data = self.request("/api/brain/status")
        self.assertEqual(status, 200)
        names = {item["name"] for item in data["systems"]}
        self.assertIn("database", names)
        self.assertIn("musica", names)
        self.assertFalse(next(item for item in data["systems"] if item["name"] == "chat-ai")["ok"])
        self.assertFalse(next(item for item in data["systems"] if item["name"] == "musica")["ok"])
        self.assertGreaterEqual(data["neurons"], jarvis.BRAIN_MIN_NEURONS)
        self.assertEqual(data["connections"], round(data["neurons"] * jarvis.CONNECTIONS_PER_NEURON))
        self.assertGreaterEqual(data["systems_active"], jarvis.BRAIN_MIN_SYSTEMS)
        self.assertGreaterEqual(data["agents_ready"], jarvis.BRAIN_MIN_AGENTS)
        self.assertTrue(data["minimums"]["neurons"])
        self.assertEqual(len(data["agents"]), len(jarvis.AGENTS))

    def test_brain_status_repairs_damaged_database(self):
        jarvis.DB_PATH.write_bytes(b"not a database")
        with patch.dict(jarvis.os.environ, {"OPENAI_API_KEY": ""}):
            _, data = self.request("/api/brain/status")
        database = next(item for item in data["systems"] if item["name"] == "database")
        self.assertTrue(database["ok"])
        self.assertTrue(database["repaired"])
        self.assertIn("database", [item["name"] for item in data["faults"]])
        self.assertTrue(jarvis.DB_PATH.with_name("jarvis.sqlite3.danneggiato").is_file())
        self.assertEqual(self.request("/api/state")[0], 200)

    def test_music_served_only_when_present(self):
        with self.assertRaises(urllib.error.HTTPError) as missing:
            urllib.request.urlopen(self.base + "/assets/music/intro.mp3", timeout=5)
        self.assertEqual(missing.exception.code, 404)
        jarvis.MUSIC_PATH.write_bytes(b"ID3mock")
        try:
            with urllib.request.urlopen(self.base + "/assets/music/intro.mp3", timeout=5) as response:
                self.assertEqual(response.headers.get_content_type(), "audio/mpeg")
                self.assertEqual(response.read(), b"ID3mock")
            _, data = self.request("/api/brain/status")
            self.assertTrue(next(item for item in data["systems"] if item["name"] == "musica")["ok"])
        finally:
            jarvis.MUSIC_PATH.unlink()

    def test_prewarm_generates_fixed_lines_only_with_key(self):
        with patch.object(jarvis, "speech_audio") as speech, patch.dict(jarvis.os.environ, {"OPENAI_API_KEY": ""}):
            jarvis.prewarm_speech()
            speech.assert_not_called()
        with patch.object(jarvis, "speech_audio") as speech, patch.dict(jarvis.os.environ, {"OPENAI_API_KEY": "test-key"}):
            jarvis.prewarm_speech()
            self.assertEqual([call.args[0] for call in speech.call_args_list], jarvis.BOOT_FIXED_LINES)

    def test_natural_speech_uses_original_voice_style(self):
        with patch.dict(jarvis.os.environ, {"OPENAI_API_KEY": "test-key"}), \
             patch.object(jarvis.urllib.request, "urlopen", return_value=io.BytesIO(b"mock-mp3")) as send:
            self.assertEqual(jarvis.natural_speech("Buongiorno, Signore."), b"mock-mp3")
            request = send.call_args.args[0]
            body = json.loads(request.data)
            self.assertEqual(request.full_url, "https://api.openai.com/v1/audio/speech")
            self.assertEqual(body["model"], "gpt-4o-mini-tts")
            self.assertEqual(body["voice"], "cedar")
            self.assertIn("voce originale", body["instructions"])


if __name__ == "__main__":
    unittest.main()
