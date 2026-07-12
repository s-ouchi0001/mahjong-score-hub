from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import numpy as np


POINT_PATTERN = re.compile(r"\d{4,6}")
SEAT_COLORS = {
    1: (40, 180, 80),
    2: (200, 170, 40),
    3: (40, 140, 220),
    4: (50, 80, 220),
}


@dataclass
class LedCandidate:
    value: int
    center_x: float
    center_y: float
    left: int
    top: int
    right: int
    bottom: int


@dataclass
class Region:
    seat: int
    center_x: float
    center_y: float
    width: float
    height: float
    rotate: int = 0

    @classmethod
    def from_json(cls, value: dict[str, Any]) -> "Region":
        return cls(
            seat=int(value["seat"]),
            center_x=float(value["centerX"]),
            center_y=float(value["centerY"]),
            width=float(value["width"]),
            height=float(value["height"]),
            rotate=int(value.get("rotate", 0)),
        )

    def rect_pixels(self, side: int) -> tuple[int, int, int, int]:
        left = max(0, int(round(side * (self.center_x - self.width / 2) / 100)))
        top = max(0, int(round(side * (self.center_y - self.height / 2) / 100)))
        right = min(side, int(round(side * (self.center_x + self.width / 2) / 100)))
        bottom = min(side, int(round(side * (self.center_y + self.height / 2) / 100)))
        return left, top, right, bottom


class StabilityBuffer:
    def __init__(self, required_count: int) -> None:
        self.required_count = max(1, required_count)
        self.history: dict[int, deque[int]] = {seat: deque(maxlen=self.required_count) for seat in range(1, 5)}

    def push(self, detected: dict[int, int]) -> dict[int, int]:
        stable: dict[int, int] = {}
        for seat, value in detected.items():
            if value <= 0:
                continue
            self.history[seat].append(value)
            if len(self.history[seat]) < self.required_count:
                continue
            value_counts = Counter(self.history[seat])
            candidate, count = value_counts.most_common(1)[0]
            if count >= self.required_count:
                stable[seat] = candidate
        return stable


class MahjongScoreRecognizer:
    def __init__(self, config: dict[str, Any]) -> None:
        self.config = config
        self.regions = [Region.from_json(region) for region in config["regions"]]
        self.base_url = str(config["baseUrl"]).rstrip("/")
        self.device_id = str(config["deviceId"])
        self.api_key = str(config.get("apiKey", ""))
        self.capture_interval = int(config.get("captureIntervalMs", 1000)) / 1000
        self.send_interval = int(config.get("sendIntervalMs", 3000)) / 1000
        self.show_preview = bool(config.get("showPreview", True))
        self.save_dir = Path(str(config.get("saveImageDir", "pc-score-recognizer/captures")))
        self.stability = StabilityBuffer(int(config.get("stableFrameCount", 3)))
        self.store_id = ""
        self.table_number = 0
        self.current_points: dict[int, int] = {1: 25000, 2: 25000, 3: 25000, 4: 25000}
        self.last_sent_points: dict[int, int] | None = None
        self.last_send_at = 0.0

    def run(self) -> None:
        self.save_dir.mkdir(parents=True, exist_ok=True)
        self.fetch_table()

        camera_source = self.config["camera"]
        if isinstance(camera_source, str) and camera_source.isdigit():
            camera_source = int(camera_source)

        capture = cv2.VideoCapture(camera_source)
        if not capture.isOpened():
            raise RuntimeError(f"カメラを開けませんでした: {self.config['camera']}")

        print("PC点数認識を開始しました。終了するにはプレビュー画面で q を押してください。")
        while True:
            loop_started_at = time.time()
            ok, frame = capture.read()
            if not ok or frame is None:
                print("カメラ画像を取得できません。再試行します。")
                time.sleep(1)
                continue

            square = center_square(frame)
            detected, debug = self.detect_points(square)
            stable = self.stability.push(detected)
            if stable:
                self.current_points.update(stable)
                if self.should_send():
                    self.send_points(square, stable)

            if self.show_preview:
                preview = draw_preview(square, self.regions, detected, stable, self.current_points)
                cv2.imshow("Mahjong score recognizer", preview)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break

            elapsed = time.time() - loop_started_at
            time.sleep(max(0.01, self.capture_interval - elapsed))

        capture.release()
        cv2.destroyAllWindows()

    def detect_points(self, square: np.ndarray) -> tuple[dict[int, int], dict[int, str]]:
        side = square.shape[0]
        detected: dict[int, int] = {}
        debug: dict[int, str] = {}

        for region in self.regions:
            left, top, right, bottom = region.rect_pixels(side)
            crop = square[top:bottom, left:right]
            if crop.size == 0:
                continue

            rotated_crop = rotate_image(crop, region.rotate)
            candidates = recognize_red_led_candidates(rotated_crop)
            square_candidates = [
                map_candidate_to_square(candidate, region.rotate, crop.shape[1], crop.shape[0], left, top)
                for candidate in candidates
            ]
            selected = select_outermost_candidate(region.seat, square_candidates)
            if selected is not None:
                detected[region.seat] = selected.value
                debug[region.seat] = str(selected.value)

        return detected, debug

    def fetch_table(self) -> None:
        query = urllib.parse.urlencode({"deviceId": self.device_id})
        response = self.request_json("GET", f"{self.base_url}/api/android/table?{query}")
        self.store_id = response["store"]["id"]
        self.table_number = int(response["table"]["tableNumber"])

        active_game = response.get("activeGame")
        if active_game:
            for seat_point in active_game.get("seatPoints", []):
                self.current_points[int(seat_point["seat"])] = int(seat_point["points"])

        print(f"卓情報: {response['store']['name']} / {self.table_number}卓")
        print("現在点数:", format_points(self.current_points))

    def should_send(self) -> bool:
        if time.time() - self.last_send_at < self.send_interval:
            return False
        if self.last_sent_points is None:
            return True
        return any(self.current_points[seat] != self.last_sent_points.get(seat) for seat in range(1, 5))

    def send_points(self, square: np.ndarray, stable: dict[int, int]) -> None:
        points = [self.current_points[seat] for seat in range(1, 5)]
        payload = {
            "storeId": self.store_id,
            "tableNumber": self.table_number,
            "deviceId": self.device_id,
            "capturedAt": datetime.now(timezone.utc).isoformat(),
            "recognition": {
                "provider": "pc-red-led-recognizer",
                "stableSeats": sorted(stable.keys()),
            },
            "points": points,
        }
        self.request_json("POST", f"{self.base_url}/api/android/point-update", payload)
        self.last_sent_points = dict(self.current_points)
        self.last_send_at = time.time()
        self.save_capture(square, points)
        print("送信:", format_points(self.current_points))

    def save_capture(self, square: np.ndarray, points: list[int]) -> None:
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        point_label = "-".join(str(point) for point in points)
        cv2.imwrite(str(self.save_dir / f"{timestamp}_{point_label}.jpg"), square)

    def request_json(self, method: str, url: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        data = None if body is None else json.dumps(body).encode("utf-8")
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("Accept", "application/json")
        if body is not None:
            request.add_header("Content-Type", "application/json; charset=utf-8")
        if self.api_key:
            request.add_header("Authorization", f"Bearer {self.api_key}")

        try:
            with urllib.request.urlopen(request, timeout=8) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            message = error.read().decode("utf-8", errors="replace")
            raise RuntimeError(f"APIエラー {error.code}: {message}") from error
        except urllib.error.URLError as error:
            raise RuntimeError(
                f"Webアプリに接続できませんでした: {url}\n"
                "先にWebアプリを起動するか、config.local.json の baseUrl を確認してください。"
            ) from error


def center_square(frame: np.ndarray) -> np.ndarray:
    height, width = frame.shape[:2]
    side = min(width, height)
    left = (width - side) // 2
    top = (height - side) // 2
    return frame[top : top + side, left : left + side].copy()


def rotate_image(image: np.ndarray, degrees: int) -> np.ndarray:
    normalized = degrees % 360
    if normalized == 90:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    if normalized == 180:
        return cv2.rotate(image, cv2.ROTATE_180)
    if normalized == 270:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return image


def recognize_red_led_points(image: np.ndarray) -> int | None:
    candidates = recognize_red_led_candidates(image)
    if not candidates:
        return None
    return candidates[0].value


def recognize_red_led_candidates(image: np.ndarray) -> list[LedCandidate]:
    mask = red_led_mask(image)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    rows = np.where(mask.sum(axis=1) > max(2, mask.shape[1] * 255 * 0.015))[0]
    if len(rows) == 0:
        return []

    row_groups = split_contiguous(rows, max_gap=max(2, image.shape[0] // 40))
    candidates: list[LedCandidate] = []
    for start_y, end_y in row_groups:
        line_top = max(0, start_y - 2)
        line_bottom = min(mask.shape[0], end_y + 3)
        line_mask = mask[line_top:line_bottom, :]
        candidates.extend(recognize_red_led_candidates_in_line(line_mask, line_top))

    if candidates:
        return sorted(candidates, key=lambda candidate: (candidate.top, candidate.left))

    candidate = recognize_red_led_candidate_from_mask(mask, 0, 0)
    return [] if candidate is None else [candidate]


def recognize_red_led_candidates_in_line(mask: np.ndarray, offset_y: int) -> list[LedCandidate]:
    columns = np.where(mask.sum(axis=0) > max(2, mask.shape[0] * 255 * 0.02))[0]
    if len(columns) == 0:
        return []

    groups = split_contiguous(columns, max_gap=max(2, mask.shape[1] // 60))
    return recognize_red_led_candidates_from_column_groups(mask, groups, 0, offset_y)


def recognize_red_led_candidate_from_mask(mask: np.ndarray, offset_x: int, offset_y: int) -> LedCandidate | None:
    columns = np.where(mask.sum(axis=0) > max(2, mask.shape[0] * 255 * 0.02))[0]
    if len(columns) == 0:
        return None

    groups = split_contiguous(columns, max_gap=max(2, mask.shape[1] // 60))
    candidates = recognize_red_led_candidates_from_column_groups(mask, groups, offset_x, offset_y)
    return candidates[0] if candidates else None


def recognize_red_led_candidates_from_column_groups(
    mask: np.ndarray,
    groups: list[tuple[int, int]],
    offset_x: int,
    offset_y: int,
) -> list[LedCandidate]:
    digit_boxes: list[tuple[int, int, int, int]] = []
    for start_x, end_x in groups:
        digit_mask = mask[:, start_x : end_x + 1]
        rows = np.where(digit_mask.sum(axis=1) > 0)[0]
        if len(rows) == 0:
            continue
        width = end_x - start_x + 1
        height = int(rows[-1] - rows[0] + 1)
        if width < 3 or height < 5:
            continue
        digit_boxes.append((start_x, int(rows[0]), end_x + 1, int(rows[-1]) + 1))

    candidates: list[LedCandidate] = []
    for chunk in split_digit_boxes(digit_boxes, mask.shape[1]):
        candidate = decode_digit_box_chunk(mask, chunk, offset_x, offset_y)
        if candidate is not None:
            candidates.append(candidate)
    return candidates


def split_digit_boxes(digit_boxes: list[tuple[int, int, int, int]], image_width: int) -> list[list[tuple[int, int, int, int]]]:
    if not digit_boxes:
        return []

    sorted_boxes = sorted(digit_boxes, key=lambda box: box[0])
    widths = [box[2] - box[0] for box in sorted_boxes]
    typical_width = float(np.median(widths)) if widths else 1
    number_gap = max(typical_width * 1.35, image_width * 0.055, 4)

    chunks: list[list[tuple[int, int, int, int]]] = [[sorted_boxes[0]]]
    for box in sorted_boxes[1:]:
        previous = chunks[-1][-1]
        gap = box[0] - previous[2]
        if gap > number_gap:
            chunks.append([box])
        else:
            chunks[-1].append(box)
    return chunks


def decode_digit_box_chunk(
    mask: np.ndarray,
    digit_boxes: list[tuple[int, int, int, int]],
    offset_x: int,
    offset_y: int,
) -> LedCandidate | None:
    if not 2 <= len(digit_boxes) <= 6:
        return None

    digits: list[str] = []
    for box in digit_boxes:
        digit = decode_seven_segment(mask[box[1] : box[3], box[0] : box[2]])
        if digit is None:
            return None
        digits.append(digit)

    value = int("".join(digits))
    if not 1000 <= value <= 99900:
        return None

    left = min(box[0] for box in digit_boxes) + offset_x
    top = min(box[1] for box in digit_boxes) + offset_y
    right = max(box[2] for box in digit_boxes) + offset_x
    bottom = max(box[3] for box in digit_boxes) + offset_y
    return LedCandidate(
        value=value,
        center_x=(left + right) / 2,
        center_y=(top + bottom) / 2,
        left=left,
        top=top,
        right=right,
        bottom=bottom,
    )


def map_candidate_to_square(
    candidate: LedCandidate,
    degrees: int,
    original_width: int,
    original_height: int,
    offset_x: int,
    offset_y: int,
) -> LedCandidate:
    original_points = [
        rotate_point_back(candidate.left, candidate.top, degrees, original_width, original_height),
        rotate_point_back(candidate.right, candidate.top, degrees, original_width, original_height),
        rotate_point_back(candidate.left, candidate.bottom, degrees, original_width, original_height),
        rotate_point_back(candidate.right, candidate.bottom, degrees, original_width, original_height),
    ]
    xs = [point[0] + offset_x for point in original_points]
    ys = [point[1] + offset_y for point in original_points]
    left = int(min(xs))
    top = int(min(ys))
    right = int(max(xs))
    bottom = int(max(ys))
    return LedCandidate(
        value=candidate.value,
        center_x=(left + right) / 2,
        center_y=(top + bottom) / 2,
        left=left,
        top=top,
        right=right,
        bottom=bottom,
    )


def rotate_point_back(x: float, y: float, degrees: int, original_width: int, original_height: int) -> tuple[float, float]:
    normalized = degrees % 360
    if normalized == 90:
        return y, original_height - x
    if normalized == 180:
        return original_width - x, original_height - y
    if normalized == 270:
        return original_width - y, x
    return x, y


def select_outermost_candidate(seat: int, candidates: list[LedCandidate]) -> LedCandidate | None:
    if not candidates:
        return None
    if seat == 1:
        return min(candidates, key=lambda candidate: candidate.center_y)
    if seat == 2:
        return max(candidates, key=lambda candidate: candidate.center_x)
    if seat == 3:
        return max(candidates, key=lambda candidate: candidate.center_y)
    if seat == 4:
        return min(candidates, key=lambda candidate: candidate.center_x)
    return candidates[0]


def red_led_mask(image: np.ndarray) -> np.ndarray:
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    lower_red_1 = np.array([0, 70, 80])
    upper_red_1 = np.array([12, 255, 255])
    lower_red_2 = np.array([165, 70, 80])
    upper_red_2 = np.array([180, 255, 255])
    mask = cv2.inRange(hsv, lower_red_1, upper_red_1) | cv2.inRange(hsv, lower_red_2, upper_red_2)
    return mask


def split_contiguous(values: np.ndarray, max_gap: int) -> list[tuple[int, int]]:
    groups: list[tuple[int, int]] = []
    start = int(values[0])
    previous = int(values[0])
    for value in values[1:]:
        current = int(value)
        if current - previous > max_gap:
            groups.append((start, previous))
            start = current
        previous = current
    groups.append((start, previous))
    return groups


def decode_seven_segment(mask: np.ndarray) -> str | None:
    height, width = mask.shape[:2]
    if height < 5 or width < 3:
        return None

    zones = [
        (0.25, 0.00, 0.75, 0.20),
        (0.65, 0.15, 1.00, 0.50),
        (0.65, 0.50, 1.00, 0.85),
        (0.25, 0.80, 0.75, 1.00),
        (0.00, 0.50, 0.35, 0.85),
        (0.00, 0.15, 0.35, 0.50),
        (0.25, 0.40, 0.75, 0.60),
    ]
    active = []
    for x1, y1, x2, y2 in zones:
        crop = mask[int(height * y1) : max(int(height * y2), int(height * y1) + 1), int(width * x1) : max(int(width * x2), int(width * x1) + 1)]
        active.append(cv2.countNonZero(crop) / max(1, crop.size) > 0.12)

    segment_key = tuple(active)
    digits = {
        (True, True, True, True, True, True, False): "0",
        (False, True, True, False, False, False, False): "1",
        (True, True, False, True, True, False, True): "2",
        (True, True, True, True, False, False, True): "3",
        (False, True, True, False, False, True, True): "4",
        (True, False, True, True, False, True, True): "5",
        (True, False, True, True, True, True, True): "6",
        (True, True, True, False, False, False, False): "7",
        (True, True, True, True, True, True, True): "8",
        (True, True, True, True, False, True, True): "9",
    }
    return digits.get(segment_key)


def draw_preview(
    square: np.ndarray,
    regions: list[Region],
    detected: dict[int, int],
    stable: dict[int, int],
    current_points: dict[int, int],
) -> np.ndarray:
    preview = square.copy()
    side = preview.shape[0]
    draw_dashed_line(preview, (0, 0), (side, side), (255, 255, 255))
    draw_dashed_line(preview, (side, 0), (0, side), (255, 255, 255))
    cv2.circle(preview, (side // 2, side // 2), max(4, side // 120), (255, 255, 255), -1)

    for region in regions:
        left, top, right, bottom = region.rect_pixels(side)
        color = SEAT_COLORS.get(region.seat, (255, 255, 255))
        overlay = preview.copy()
        cv2.rectangle(overlay, (left, top), (right, bottom), color, -1)
        cv2.addWeighted(overlay, 0.18, preview, 0.82, 0, preview)
        cv2.rectangle(preview, (left, top), (right, bottom), color, 2)
        label = f"seat{region.seat}"
        if region.seat in detected:
            label += f" {detected[region.seat]}"
        if region.seat in stable:
            label += " stable"
        cv2.putText(preview, label, (left + 6, max(22, top + 22)), cv2.FONT_HERSHEY_SIMPLEX, 0.55, color, 2)

    summary = " / ".join(f"{seat}:{current_points[seat]}" for seat in range(1, 5))
    cv2.rectangle(preview, (0, side - 34), (side, side), (0, 0, 0), -1)
    cv2.putText(preview, summary, (10, side - 11), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (255, 255, 255), 2)
    return preview


def draw_dashed_line(image: np.ndarray, start: tuple[int, int], end: tuple[int, int], color: tuple[int, int, int]) -> None:
    dash = 18
    gap = 12
    length = int(np.hypot(end[0] - start[0], end[1] - start[1]))
    if length <= 0:
        return
    for offset in range(0, length, dash + gap):
        segment_start = offset / length
        segment_end = min(offset + dash, length) / length
        x1 = int(start[0] + (end[0] - start[0]) * segment_start)
        y1 = int(start[1] + (end[1] - start[1]) * segment_start)
        x2 = int(start[0] + (end[0] - start[0]) * segment_end)
        y2 = int(start[1] + (end[1] - start[1]) * segment_end)
        cv2.line(image, (x1, y1), (x2, y2), color, 1)


def format_points(points: dict[int, int]) -> str:
    return " / ".join(f"席{seat} {points[seat]}" for seat in range(1, 5))


def load_config(path: str) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def main() -> None:
    parser = argparse.ArgumentParser(description="PC用 麻雀卓点数認識")
    parser.add_argument("--config", default="pc-score-recognizer/config.example.json", help="設定JSONのパス")
    args = parser.parse_args()
    recognizer = MahjongScoreRecognizer(load_config(args.config))
    recognizer.run()


if __name__ == "__main__":
    main()
