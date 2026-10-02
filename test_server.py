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
        jarvis.DB_PATH = Path(cls.temp.name) / "jarvis.sqlite3"
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
        for path, symbol in [("/voice.js", b"JarvisVoiceGate"), ("/browser-store.js", b"JarvisBrowserStore"), ("/neurons-3d.js", b"JarvisNeural3D")]:
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
