import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useRef, useState } from "react";

import { calcCenter, calcDistance, formatDecimal, formatOffset, readTouches } from "../../utils/touch";

const pageStyle = {
  minHeight: "100vh",
  padding: "32rpx",
  display: "flex",
  flexDirection: "column",
  gap: "18rpx",
};

const targetStyle = {
  minHeight: "520rpx",
  padding: "24rpx",
  background: "#dbeafe",
  borderRadius: "28rpx",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center",
};

export default function GesturePage() {
  const [statusText, setStatusText] = useState("Gesture status: idle");
  const [activeText, setActiveText] = useState("Active touches: 0");
  const [scaleText, setScaleText] = useState("Gesture scale: 1.00");
  const [offsetText, setOffsetText] = useState("Gesture offset: 0,0");
  const [tapCountText, setTapCountText] = useState("Tap count: 0");
  const pinchStartRef = useRef(null);
  const tapCountRef = useRef(0);

  const handleTouchStart = (event) => {
    const touches = readTouches(event);
    setActiveText(`Active touches: ${touches.length}`);
    if (touches.length >= 2) {
      pinchStartRef.current = {
        distance: calcDistance(touches),
        center: calcCenter(touches),
      };
      setStatusText("Gesture status: two-finger-ready");
      return;
    }
    setStatusText("Gesture status: touch-started");
  };

  const handleTouchMove = (event) => {
    const touches = readTouches(event);
    setActiveText(`Active touches: ${touches.length}`);
    if (touches.length >= 2) {
      const currentDistance = calcDistance(touches);
      const currentCenter = calcCenter(touches);
      const baseline = pinchStartRef.current;
      const nextScale = baseline && baseline.distance > 0 ? currentDistance / baseline.distance : 1;
      const baseCenter = baseline?.center ?? currentCenter;
      setScaleText(`Gesture scale: ${formatDecimal(nextScale)}`);
      setOffsetText(
        `Gesture offset: ${formatOffset(currentCenter.x - baseCenter.x, currentCenter.y - baseCenter.y)}`,
      );
      setStatusText("Gesture status: two-finger-pan-zoom");
      return;
    }
    if (touches.length === 1) {
      setStatusText("Gesture status: dragging");
    }
  };

  const handleTouchEnd = (event) => {
    const touches = readTouches(event);
    setActiveText(`Active touches: ${touches.length}`);
    if (touches.length === 0) {
      pinchStartRef.current = null;
      setStatusText("Gesture status: ended");
    }
  };

  const handleTap = () => {
    tapCountRef.current += 1;
    setTapCountText(`Tap count: ${tapCountRef.current}`);
    setStatusText("Gesture status: tapped");
  };

  return (
    <View id="gesture-page" style={pageStyle}>
      <Text id="gesture-title" style={{ fontSize: "44rpx", fontWeight: "700" }}>
        Gesture Lab
      </Text>
      <Text id="gesture-helper">
        Touch the target or use two fingers to pan and zoom.
      </Text>
      <View
        id="gesture-target"
        style={targetStyle}
        onClick={handleTap}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Text>Gesture Target</Text>
      </View>
      <Text id="gesture-status-text">{statusText}</Text>
      <Text id="gesture-active-text">{activeText}</Text>
      <Text id="gesture-scale-text">{scaleText}</Text>
      <Text id="gesture-offset-text">{offsetText}</Text>
      <Text id="gesture-tap-count-text">{tapCountText}</Text>
      <Button id="gesture-back-home-button" onClick={() => void Taro.navigateBack()}>
        Back to the previous page
      </Button>
    </View>
  );
}
