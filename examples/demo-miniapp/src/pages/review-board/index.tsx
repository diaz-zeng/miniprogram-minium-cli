import { Button, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useRef, useState } from "react";

import { getDemoState } from "../../store/demo-state";
import { calcCenter, calcDistance, formatDecimal, formatOffset, readTouches } from "../../utils/touch";

const pageStyle = {
  minHeight: "100vh",
  padding: "32rpx",
  display: "flex",
  flexDirection: "column",
  gap: "18rpx",
};

const targetStyle = {
  position: "relative",
  minHeight: "560rpx",
  padding: "24rpx",
  background: "#ede9fe",
  borderRadius: "28rpx",
  overflow: "hidden",
  border: "2rpx solid #c4b5fd",
};

const targetLayerStyle = {
  position: "absolute",
  left: "50%",
  top: "50%",
  width: "420rpx",
  height: "420rpx",
  marginLeft: "-210rpx",
  marginTop: "-210rpx",
};

const ringStyle = {
  position: "absolute",
  borderRadius: "999rpx",
  border: "4rpx solid rgba(109, 40, 217, 0.55)",
};

const crosshairStyle = {
  position: "absolute",
  background: "rgba(91, 33, 182, 0.25)",
};

const beaconCardStyle = {
  position: "absolute",
  right: "22rpx",
  top: "20rpx",
  minWidth: "132rpx",
  padding: "12rpx 16rpx",
  borderRadius: "18rpx",
  background: "rgba(255, 255, 255, 0.9)",
  boxShadow: "0 12rpx 24rpx rgba(91, 33, 182, 0.16)",
};

const markerDotStyle = {
  position: "absolute",
  width: "28rpx",
  height: "28rpx",
  marginLeft: "-14rpx",
  marginTop: "-14rpx",
  borderRadius: "999rpx",
  background: "#dc2626",
  boxShadow: "0 0 0 10rpx rgba(220, 38, 38, 0.16)",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function markerToBoardPosition(markerLabel: string) {
  const [rawX, rawY] = markerLabel.split(",").map((value) => Number(value));
  const x = Number.isFinite(rawX) ? rawX : 0;
  const y = Number.isFinite(rawY) ? rawY : 0;
  return {
    left: `${clamp((x / 375) * 100, 12, 88)}%`,
    top: `${clamp((y / 720) * 100, 12, 88)}%`,
  };
}

export default function ReviewBoardPage() {
  const [statusText, setStatusText] = useState("Review status: idle");
  const [activeText, setActiveText] = useState("Review active touches: 0");
  const [scaleText, setScaleText] = useState("Review scale: 1.00");
  const [offsetText, setOffsetText] = useState("Review offset: 0,0");
  const [filterModeText, setFilterModeText] = useState("Marker filter: all");
  const [markerSummaryText, setMarkerSummaryText] = useState("Marker summary: 0 markers");
  const [lastMarkerText, setLastMarkerText] = useState("Last marker snapshot: none");
  const [referenceText, setReferenceText] = useState("Reference beacon: baseline");
  const [transformStyle, setTransformStyle] = useState({
    ...targetLayerStyle,
    transform: "translate(0px, 0px) scale(1)",
  });
  const [markerLabels, setMarkerLabels] = useState<string[]>([]);
  const pinchStartRef = useRef<{ distance: number; center: { x: number; y: number } } | null>(null);

  useDidShow(() => {
    const snapshot = getDemoState();
    setMarkerSummaryText(`Marker summary: ${snapshot.markerCount} markers`);
    setLastMarkerText(`Last marker snapshot: ${snapshot.lastMarkerLabel}`);
    setMarkerLabels(Array.isArray(snapshot.markerLabels) ? snapshot.markerLabels : []);
  });

  const handleTouchStart = (event) => {
    const touches = readTouches(event);
    setActiveText(`Review active touches: ${touches.length}`);
    if (touches.length >= 2) {
      pinchStartRef.current = {
        distance: calcDistance(touches),
        center: calcCenter(touches),
      };
      setStatusText("Review status: two-finger-ready");
      return;
    }
    setStatusText("Review status: single-finger-preview");
  };

  const handleTouchMove = (event) => {
    const touches = readTouches(event);
    setActiveText(`Review active touches: ${touches.length}`);
    if (touches.length >= 2) {
      const currentDistance = calcDistance(touches);
      const currentCenter = calcCenter(touches);
      const baseline = pinchStartRef.current;
      const nextScale = baseline && baseline.distance > 0 ? currentDistance / baseline.distance : 1;
      const baseCenter = baseline?.center ?? currentCenter;
      const offsetX = Math.round(currentCenter.x - baseCenter.x);
      const offsetY = Math.round(currentCenter.y - baseCenter.y);
      setScaleText(`Review scale: ${formatDecimal(nextScale)}`);
      setOffsetText(`Review offset: ${formatOffset(offsetX, offsetY)}`);
      setReferenceText(`Reference beacon: ${formatDecimal(nextScale)}x @ ${formatOffset(offsetX, offsetY)}`);
      setTransformStyle({
        ...targetLayerStyle,
        transform: `translate(${offsetX}px, ${offsetY}px) scale(${nextScale})`,
      });
      setStatusText("Review status: two-finger-pan-zoom");
      return;
    }
    if (touches.length === 1) {
      setStatusText("Review status: single-finger-preview");
    }
  };

  const handleTouchEnd = (event) => {
    const touches = readTouches(event);
    setActiveText(`Review active touches: ${touches.length}`);
    if (touches.length === 0) {
      pinchStartRef.current = null;
      setStatusText("Review status: ended");
    }
  };

  const handleToggleFilter = () => {
    setFilterModeText((previous) => (previous === "Marker filter: all" ? "Marker filter: latest" : "Marker filter: all"));
  };

  return (
    <View id="review-board-page" style={pageStyle}>
      <Text id="review-board-title" style={{ fontSize: "44rpx", fontWeight: "700" }}>
        Review Board
      </Text>
      <Text id="review-board-helper">
        Use two fingers to pan and zoom the review board after placing markers.
      </Text>
      <View
        id="review-board-target"
        style={targetStyle}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <View id="review-board-layer" style={transformStyle}>
          <View id="review-ring-outer" style={{ ...ringStyle, inset: "0" }} />
          <View
            id="review-ring-middle"
            style={{ ...ringStyle, left: "58rpx", top: "58rpx", right: "58rpx", bottom: "58rpx" }}
          />
          <View
            id="review-ring-inner"
            style={{ ...ringStyle, left: "122rpx", top: "122rpx", right: "122rpx", bottom: "122rpx" }}
          />
          <View
            id="review-crosshair-horizontal"
            style={{ ...crosshairStyle, left: "0", right: "0", top: "50%", height: "4rpx", marginTop: "-2rpx" }}
          />
          <View
            id="review-crosshair-vertical"
            style={{ ...crosshairStyle, top: "0", bottom: "0", left: "50%", width: "4rpx", marginLeft: "-2rpx" }}
          />
          <View id="review-reference-card" style={beaconCardStyle}>
            <Text id="review-reference-card-title" style={{ fontSize: "24rpx", fontWeight: "700", color: "#5b21b6" }}>
              Reference Beacon
            </Text>
            <Text id="review-reference-card-body" style={{ fontSize: "22rpx", color: "#6d28d9" }}>
              Compare this panel before and after zooming.
            </Text>
          </View>
          {markerLabels.map((label, index) => (
            <View
              key={`${label}-${index}`}
              id={`review-marker-dot-${index + 1}`}
              style={{
                ...markerDotStyle,
                ...markerToBoardPosition(label),
                opacity: index === markerLabels.length - 1 ? 1 : 0.6,
              }}
            />
          ))}
        </View>
      </View>
      <Text id="review-status-text">{statusText}</Text>
      <Text id="review-active-text">{activeText}</Text>
      <Text id="review-scale-text">{scaleText}</Text>
      <Text id="review-offset-text">{offsetText}</Text>
      <Text id="review-reference-text">{referenceText}</Text>
      <Text id="review-filter-mode-text">{filterModeText}</Text>
      <Text id="review-marker-summary-text">{markerSummaryText}</Text>
      <Text id="review-last-marker-text">{lastMarkerText}</Text>
      <Button id="review-filter-toggle-button" onClick={handleToggleFilter}>
        Switch marker filter
      </Button>
      <Button id="review-board-back-button" onClick={() => void Taro.navigateBack()}>
        Back to the previous page
      </Button>
    </View>
  );
}
