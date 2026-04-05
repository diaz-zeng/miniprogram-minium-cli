import { Button, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { useState } from "react";

import { resetDemoState, setLoginState } from "../../store/demo-state";

const containerStyle = {
  minHeight: "100vh",
  padding: "40rpx",
  display: "flex",
  flexDirection: "column",
  gap: "24rpx",
};

export default function LoginPage() {
  const [status, setStatus] = useState("idle");

  const handleLogin = () => {
    if (status === "pending") {
      return;
    }
    setStatus("pending");
    setLoginState("pending");
    setTimeout(() => {
      setLoginState("logged-in");
      void Taro.redirectTo({ url: "/pages/home/index?from=login" });
    }, 450);
  };

  const handleReset = () => {
    resetDemoState();
    setStatus("idle");
  };

  return (
    <View id="login-page" style={containerStyle}>
      <Text id="login-title" style={{ fontSize: "44rpx", fontWeight: "700" }}>
        Demo Login
      </Text>
      <Text id="login-subtitle">
        Use the mock WeChat login button to reach the home page.
      </Text>
      <Text id="login-status-text">{`Login status: ${status}`}</Text>
      <Button id="login-button" onClick={handleLogin}>
        WeChat Login
      </Button>
      <Button id="login-reset-button" onClick={handleReset}>
        Reset login state
      </Button>
    </View>
  );
}
