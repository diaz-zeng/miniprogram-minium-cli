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

export default function HomePage() {
  const [snapshot, setSnapshot] = useState(getDemoState());
  const [searchDraft, setSearchDraft] = useState(snapshot.searchKeyword);
  const [formOpen, setFormOpen] = useState(false);
  const [practiceDraft, setPracticeDraft] = useState("12");
  const [saveState, setSaveState] = useState("idle");

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
