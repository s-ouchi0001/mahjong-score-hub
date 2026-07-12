from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


DEFAULT_CONFIG = Path("pc-score-recognizer/config.example.json")
LOCAL_CONFIG = Path("pc-score-recognizer/config.local.json")


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def save_json(path: Path, value: dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8") as file:
        json.dump(value, file, ensure_ascii=False, indent=2)
        file.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="PC認識アプリの送信先設定")
    parser.add_argument("--baseUrl", required=True, help="WebアプリURL。例: http://127.0.0.1:3000")
    parser.add_argument("--deviceId", required=True, help="卓管理画面に表示されているカメラ端末ID")
    parser.add_argument("--camera", default=None, help="Webカメラ番号またはTapo C120のRTSP URL")
    parser.add_argument("--apiKey", default=None, help="任意のAPIキー")
    args = parser.parse_args()

    config = load_json(LOCAL_CONFIG if LOCAL_CONFIG.exists() else DEFAULT_CONFIG)
    config["baseUrl"] = args.baseUrl.rstrip("/")
    config["deviceId"] = args.deviceId.strip()
    if args.camera is not None:
        config["camera"] = int(args.camera) if args.camera.isdigit() else args.camera
    if args.apiKey is not None:
        config["apiKey"] = args.apiKey

    save_json(LOCAL_CONFIG, config)
    print("PC認識アプリの設定を保存しました。")
    print(f"送信先: {config['baseUrl']}")
    print(f"端末ID: {config['deviceId']}")


if __name__ == "__main__":
    main()
