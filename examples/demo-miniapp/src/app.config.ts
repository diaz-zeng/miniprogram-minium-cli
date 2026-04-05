export default defineAppConfig({
  pages: [
    "pages/login/index",
    "pages/home/index",
    "pages/gesture/index",
    "pages/cursor-lab/index",
    "pages/review-board/index",
  ],
  window: {
    navigationBarTitleText: "CLI Demo Miniapp",
    navigationBarBackgroundColor: "#ffffff",
    navigationBarTextStyle: "black",
    backgroundColor: "#f7f7f7",
    backgroundTextStyle: "light",
  },
});
