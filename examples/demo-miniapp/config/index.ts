import { defineConfig } from "@tarojs/cli";

import devConfig from "./dev";
import prodConfig from "./prod";

export default defineConfig(async (merge, { command }) => {
  const baseConfig = {
    projectName: "miniprogram-minium-cli-demo",
    date: "2026-04-04",
    designWidth: 750,
    sourceRoot: "src",
    outputRoot: "dist",
    framework: "react",
    compiler: "webpack5",
    plugins: ["@tarojs/plugin-framework-react", "@tarojs/plugin-platform-weapp"],
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {},
        },
        cssModules: {
          enable: false,
        },
      },
    },
  };

  if (command === "build") {
    return merge({}, baseConfig, prodConfig);
  }

  return merge({}, baseConfig, devConfig);
});
