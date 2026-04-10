import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

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
  display: "flex",
  flexDirection: "column",
  gap: "12rpx",
};

const capabilityTextStyle = {
  fontSize: "28rpx",
  color: "#334155",
};

export default function BridgeLabPage() {
  return (
    <View id="bridge-lab-page" style={pageStyle}>
      <Text id="bridge-lab-title" style={{ fontSize: "44rpx", fontWeight: "700" }}>
        Bridge Lab
      </Text>
      <Text id="bridge-lab-subtitle">
        Run bridge-focused regression plans from this page to validate non-UI miniapp capabilities.
      </Text>

      <View id="bridge-high-priority-card" style={cardStyle}>
        <Text id="bridge-high-priority-title" style={{ fontSize: "34rpx", fontWeight: "600" }}>
          High-priority bridge actions
        </Text>
        <Text id="bridge-high-priority-summary" style={capabilityTextStyle}>
          Storage, navigation, app context, settings, clipboard, toast, and loading plans start here.
        </Text>
        <Text style={capabilityTextStyle}>Bundled plan: `09-bridge-high-priority.exact.plan.json`</Text>
      </View>

      <View id="bridge-medium-priority-card" style={cardStyle}>
        <Text id="bridge-medium-priority-title" style={{ fontSize: "34rpx", fontWeight: "600" }}>
          Medium-priority bridge actions
        </Text>
        <Text id="bridge-medium-priority-summary" style={capabilityTextStyle}>
          Location, media, file, device, auth, and session flows are demonstrated with a placeholder-safe plan.
        </Text>
        <Text style={capabilityTextStyle}>Bundled plan: `10-bridge-medium.placeholder.plan.json`</Text>
      </View>

      <View id="bridge-touristappid-card" style={{ ...cardStyle, border: "2rpx solid #f59e0b" }}>
        <Text id="bridge-touristappid-title" style={{ fontSize: "34rpx", fontWeight: "600" }}>
          Tourist AppID restricted flows
        </Text>
        <Text id="bridge-touristappid-note" style={capabilityTextStyle}>
          Plans that require a developer-owned AppID should be skipped automatically when the demo project still uses
          touristappid.
        </Text>
        <Text style={capabilityTextStyle}>Bundled plan: `11-bridge-tourist-skip.exact.plan.json`</Text>
      </View>

      <View id="bridge-navigation-card" style={cardStyle}>
        <Text id="bridge-navigation-title" style={{ fontSize: "34rpx", fontWeight: "600" }}>
          Supporting pages
        </Text>
        <Button
          id="bridge-to-home-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/home/index?from=bridge-lab" })}
        >
          Open the home page
        </Button>
        <Button
          id="bridge-to-review-board-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/review-board/index?from=bridge-lab" })}
        >
          Open the review board
        </Button>
      </View>
    </View>
  );
}
