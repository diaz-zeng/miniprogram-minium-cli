interface DemoState {
  loginState: string;
  practiceTotal: number;
  searchKeyword: string;
  markerCount: number;
  lastMarkerLabel: string;
  markerLabels: string[];
}

const state: DemoState = {
  loginState: "logged-out",
  practiceTotal: 0,
  searchKeyword: "",
  markerCount: 0,
  lastMarkerLabel: "none",
  markerLabels: [],
};

export function getDemoState() {
  return { ...state };
}

export function setLoginState(nextState: string) {
  state.loginState = nextState;
}

export function setPracticeTotal(total: number) {
  state.practiceTotal = total;
}

export function setSearchKeyword(keyword: string) {
  state.searchKeyword = keyword;
}

export function setMarkerSnapshot(markerCount: number, lastMarkerLabel: string, markerLabels: string[] = []) {
  state.markerCount = markerCount;
  state.lastMarkerLabel = lastMarkerLabel;
  state.markerLabels = [...markerLabels];
}

export function resetDemoState() {
  state.loginState = "logged-out";
  state.practiceTotal = 0;
  state.searchKeyword = "";
  state.markerCount = 0;
  state.lastMarkerLabel = "none";
  state.markerLabels = [];
}
