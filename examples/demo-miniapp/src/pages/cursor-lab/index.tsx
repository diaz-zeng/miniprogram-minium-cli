import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useRef, useState } from "react";

import { setMarkerSnapshot } from "../../store/demo-state";
import { formatOffset, readTouches } from "../../utils/touch";

const pageStyle = {
  minHeight: "100vh",
  padding: "32rpx",
  display: "flex",
  flexDirection: "column",
  gap: "18rpx",
};

const cardStyle = {
  padding: "24rpx",
  background: "#ffffff",
  borderRadius: "24rpx",
};

const dragButtonStyle = {
  minHeight: "220rpx",
  padding: "24rpx",
  borderRadius: "28rpx",
  background: "#dbeafe",
  color: "#0f172a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

const boardStyle = {
  position: "relative",
  minHeight: "360rpx",
  borderRadius: "28rpx",
  background: "linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%)",
  overflow: "hidden",
  border: "2rpx solid #93c5fd",
};

const cursorDotStyle = {
  position: "absolute",
  width: "28rpx",
  height: "28rpx",
  borderRadius: "999rpx",
  background: "#1d4ed8",
  boxShadow: "0 0 0 10rpx rgba(29, 78, 216, 0.16)",
};

const markerDotStyle = {
  position: "absolute",
  width: "32rpx",
  height: "32rpx",
  borderRadius: "999rpx",
  background: "#dc2626",
  boxShadow: "0 0 0 12rpx rgba(220, 38, 38, 0.14)",
};

const markerTrailStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8rpx",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatPoint(x: number, y: number) {
  return `${Math.round(x)},${Math.round(y)}`;
}

function projectToBoard(x: number, y: number) {
  return {
    left: `${clamp((x / 375) * 100, 8, 92)}%`,
    top: `${clamp((y / 720) * 100, 10, 90)}%`,
  };
}

export default function CursorLabPage() {
  const [cursorModeText, setCursorModeText] = useState("Cursor mode: idle");
  const [activeText, setActiveText] = useState("Active touches: 0");
  const [cursorPositionText, setCursorPositionText] = useState("Cursor position: 0,0");
  const [cursorOffsetText, setCursorOffsetText] = useState("Cursor offset: 0,0");
  const [markerCountText, setMarkerCountText] = useState("Marker count: 0");
  const [lastMarkerText, setLastMarkerText] = useState("Last marker: none");
  const [markerTrailText, setMarkerTrailText] = useState("Marker trail: none");
  const [boardCursorStyle, setBoardCursorStyle] = useState(projectToBoard(0, 0));
  const [boardMarkerStyles, setBoardMarkerStyles] = useState<Array<{ left: string; top: string }>>([]);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const cursorPointRef = useRef({ x: 0, y: 0 });
  const markerCountRef = useRef(0);
  const markerLabelsRef = useRef<string[]>([]);

  const syncCursor = (x: number, y: number) => {
    const nextPoint = { x: Math.round(x), y: Math.round(y) };
    cursorPointRef.current = nextPoint;
    setCursorPositionText(`Cursor position: ${formatPoint(nextPoint.x, nextPoint.y)}`);
    setBoardCursorStyle(projectToBoard(nextPoint.x, nextPoint.y));
    return nextPoint;
  };

  const handleTouchStart = (event) => {
    const touches = readTouches(event);
    setActiveText(`Active touches: ${touches.length}`);
    const primaryTouch = touches[0];
    if (!primaryTouch) {
      return;
    }
    dragStartRef.current = primaryTouch;
    syncCursor(primaryTouch.x, primaryTouch.y);
    setCursorOffsetText("Cursor offset: 0,0");
    setCursorModeText("Cursor mode: armed");
  };

  const handleTouchMove = (event) => {
    const touches = readTouches(event);
    setActiveText(`Active touches: ${touches.length}`);
    const primaryTouch = touches[0];
    if (!primaryTouch) {
      return;
    }
    const startPoint = dragStartRef.current ?? primaryTouch;
    const nextPoint = syncCursor(primaryTouch.x, primaryTouch.y);
    setCursorOffsetText(
      `Cursor offset: ${formatOffset(nextPoint.x - startPoint.x, nextPoint.y - startPoint.y)}`,
    );
    setCursorModeText("Cursor mode: drag-active");
  };

  const handleTouchEnd = (event) => {
    const touches = readTouches(event);
    setActiveText(`Active touches: ${touches.length}`);
    if (touches.length === 0) {
      dragStartRef.current = null;
      setCursorModeText("Cursor mode: released");
    }
  };

  const handleDropMarker = () => {
    const nextCount = markerCountRef.current + 1;
    markerCountRef.current = nextCount;
    const currentPoint = cursorPointRef.current;
    const markerLabel = formatPoint(currentPoint.x, currentPoint.y);
    const nextLabels = [...markerLabelsRef.current, markerLabel].slice(-4);
    markerLabelsRef.current = nextLabels;
    setMarkerCountText(`Marker count: ${nextCount}`);
    setLastMarkerText(`Last marker: ${markerLabel}`);
    setMarkerTrailText(`Marker trail: ${nextLabels.join(" -> ")}`);
    setBoardMarkerStyles(
      nextLabels.map((label) => {
        const [x, y] = label.split(",").map((value) => Number(value));
        return projectToBoard(x, y);
      }),
    );
    setMarkerSnapshot(nextCount, markerLabel, nextLabels);
  };

  return (
    <View id="cursor-lab-page" style={pageStyle}>
      <Text id="cursor-lab-title" style={{ fontSize: "44rpx", fontWeight: "700" }}>
        Cursor Lab
      </Text>
      <Text id="cursor-lab-helper">
        Hold the drag button to move the cursor, then tap the marker button with another pointer.
      </Text>

      <View id="cursor-board-card" style={cardStyle}>
        <Text id="cursor-board-title">Interactive board</Text>
        <View id="cursor-preview-board" style={boardStyle}>
          <View id="cursor-preview-dot" style={{ ...cursorDotStyle, ...boardCursorStyle }} />
          {boardMarkerStyles.map((style, index) => (
            <View
              key={`marker-${index}`}
              id={`marker-preview-dot-${index + 1}`}
              style={{
                ...markerDotStyle,
                ...style,
                opacity: index === boardMarkerStyles.length - 1 ? 1 : 0.56,
              }}
            />
          ))}
        </View>
      </View>

      <Button
        id="cursor-drag-button"
        style={dragButtonStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        Hold and drag the cursor
      </Button>

      <Button id="marker-drop-button" onClick={handleDropMarker}>
        Tap to place a marker
      </Button>

      <Text id="cursor-mode-text">{cursorModeText}</Text>
      <Text id="cursor-active-text">{activeText}</Text>
      <Text id="cursor-position-text">{cursorPositionText}</Text>
      <Text id="cursor-offset-text">{cursorOffsetText}</Text>
      <Text id="marker-count-text">{markerCountText}</Text>
      <Text id="last-marker-text">{lastMarkerText}</Text>
      <View id="marker-trail-panel" style={markerTrailStyle}>
        <Text id="marker-trail-text">{markerTrailText}</Text>
      </View>

      <Button id="open-review-board-button" onClick={() => void Taro.navigateTo({ url: "/pages/review-board/index" })}>
        Open the review board
      </Button>
      <Button id="cursor-lab-back-button" onClick={() => void Taro.navigateBack()}>
        Back to the previous page
      </Button>
    </View>
  );
}
