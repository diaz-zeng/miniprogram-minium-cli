import { Button, Input, Text, View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useMemo, useState } from "react";

import { getDemoState, setPracticeTotal, setSearchKeyword } from "../../store/demo-state";

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

const DEFAULT_NETWORK_BASE_URL = "https://service.invalid";
const NETWORK_BASE_URL_STORAGE_KEY = "networkBaseUrl";

function getNetworkBaseUrl() {
  try {
    const configuredUrl = Taro.getStorageSync<string>(NETWORK_BASE_URL_STORAGE_KEY);
    const trimmedUrl = typeof configuredUrl === "string" ? configuredUrl.trim() : "";
    if (trimmedUrl.length > 0) {
      return trimmedUrl.replace(/\/+$/, "");
    }
  } catch (_error) {
    return DEFAULT_NETWORK_BASE_URL;
  }
  return DEFAULT_NETWORK_BASE_URL;
}

export default function HomePage() {
  const [snapshot, setSnapshot] = useState(getDemoState());
  const [searchDraft, setSearchDraft] = useState(snapshot.searchKeyword);
  const [formOpen, setFormOpen] = useState(false);
  const [practiceDraft, setPracticeDraft] = useState("12");
  const [saveState, setSaveState] = useState("idle");
  const [networkState, setNetworkState] = useState("idle");
  const [networkLastRequest, setNetworkLastRequest] = useState("none");
  const [networkStatusCode, setNetworkStatusCode] = useState("n/a");

  useDidShow(() => {
    const nextSnapshot = getDemoState();
    setSnapshot(nextSnapshot);
    setSearchDraft(nextSnapshot.searchKeyword);
  });

  const loginStateText = useMemo(
    () => `Login state: ${snapshot.loginState}`,
    [snapshot.loginState],
  );

  const handleSearchInput = (event) => {
    const nextValue = String(event?.detail?.value ?? "");
    setSearchDraft(nextValue);
    setSearchKeyword(nextValue);
    setSnapshot(getDemoState());
  };

  const handleSavePractice = () => {
    setSaveState("saving");
    setTimeout(() => {
      const parsedValue = Number(practiceDraft || "0");
      setPracticeTotal(Number.isFinite(parsedValue) ? parsedValue : 0);
      setSnapshot(getDemoState());
      setSaveState("saved");
      setFormOpen(false);
    }, 350);
  };

  const handleNetworkRequest = async (kind: "login" | "reviews") => {
    const baseUrl = getNetworkBaseUrl();
    const requestConfig = kind === "login"
      ? {
          url: `${baseUrl}/api/login`,
          method: "POST" as const,
          data: { username: "demo-user" },
        }
      : {
          url: `${baseUrl}/api/reviews?tab=main`,
          method: "GET" as const,
        };
    setNetworkState(`pending:${kind}`);
    setNetworkLastRequest(`${requestConfig.method} ${requestConfig.url}`);
    setNetworkStatusCode("pending");
    try {
      const response = await Taro.request(requestConfig);
      setNetworkState(`success:${kind}`);
      setNetworkStatusCode(String(response.statusCode ?? "unknown"));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNetworkState(`failed:${kind}`);
      setNetworkStatusCode(message || "failed");
    }
  };

  return (
    <View id="home-page" style={pageStyle}>
      <Text id="home-title" style={{ fontSize: "44rpx", fontWeight: "700" }}>
        Demo Home
      </Text>
      <Text id="home-subtitle">
        Use exact ids or fuzzy text locators to automate this page.
      </Text>
      <Text id="login-state-text">{loginStateText}</Text>

      <View id="search-card" style={cardStyle}>
        <Text id="search-card-title">Search Playground</Text>
        <Input
          id="search-input"
          value={searchDraft}
          placeholder="Type a keyword"
          onInput={handleSearchInput}
          style={{ marginTop: "16rpx", padding: "20rpx", background: "#f3f4f6", borderRadius: "16rpx" }}
        />
        <Text id="search-value-text" style={{ marginTop: "16rpx", display: "block" }}>
          {`Search keyword: ${snapshot.searchKeyword || "empty"}`}
        </Text>
      </View>

      <View id="practice-card" style={cardStyle}>
        <Text id="practice-card-title">Practice Panel Playground</Text>
        <Text id="practice-total-text" style={{ marginTop: "12rpx", display: "block" }}>
          {`Practice total: ${snapshot.practiceTotal}`}
        </Text>
        <Text id="practice-save-state-text" style={{ marginTop: "8rpx", display: "block" }}>
          {`Practice save state: ${saveState}`}
        </Text>
        <Button id="open-practice-panel-button" onClick={() => setFormOpen(true)}>
          Open the practice panel
        </Button>
      </View>

      <View id="navigation-card" style={cardStyle}>
        <Text id="navigation-card-title">Navigation Playground</Text>
        <Button
          id="home-to-bridge-lab-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/bridge-lab/index" })}
        >
          Open the bridge lab
        </Button>
        <Button id="home-to-gesture-button" onClick={() => void Taro.navigateTo({ url: "/pages/gesture/index" })}>
          Open the gesture lab
        </Button>
        <Button
          id="home-to-cursor-lab-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/cursor-lab/index" })}
        >
          Open the cursor lab
        </Button>
        <Button
          id="home-to-review-board-button"
          onClick={() => void Taro.navigateTo({ url: "/pages/review-board/index" })}
        >
          Open the review board
        </Button>
      </View>

      <View id="network-card" style={cardStyle}>
        <Text id="network-card-title">Network Playground</Text>
        <Text id="network-request-state-text" style={{ marginTop: "12rpx", display: "block" }}>
          {`Network request state: ${networkState}`}
        </Text>
        <Text id="network-last-request-text" style={{ marginTop: "8rpx", display: "block" }}>
          {`Network last request: ${networkLastRequest}`}
        </Text>
        <Text id="network-status-code-text" style={{ marginTop: "8rpx", display: "block" }}>
          {`Network status code: ${networkStatusCode}`}
        </Text>
        <Button id="network-login-request-button" onClick={() => void handleNetworkRequest("login")}>
          Trigger login request
        </Button>
        <Button id="network-reviews-request-button" onClick={() => void handleNetworkRequest("reviews")}>
          Trigger reviews request
        </Button>
      </View>

      {formOpen ? (
        <View id="practice-form-modal" style={{ ...cardStyle, border: "2rpx solid #2563eb" }}>
          <Text id="practice-modal-title" style={{ fontSize: "34rpx", fontWeight: "600" }}>
            Practice form is ready
          </Text>
          <Text id="practice-modal-helper" style={{ marginTop: "12rpx", display: "block" }}>
            Enter the total practice count and save it.
          </Text>
          <Input
            id="practice-count-input"
            type="number"
            value={practiceDraft}
            onInput={(event) => setPracticeDraft(String(event?.detail?.value ?? ""))}
            style={{ marginTop: "18rpx", padding: "20rpx", background: "#eff6ff", borderRadius: "16rpx" }}
          />
          <Button id="practice-save-button" onClick={handleSavePractice}>
            Save practice total
          </Button>
          <Button id="practice-close-button" onClick={() => setFormOpen(false)}>
            Close the practice panel
          </Button>
        </View>
      ) : null}
    </View>
  );
}
