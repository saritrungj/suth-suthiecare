import base from "./playwright.config.mjs";
export default {
  ...base,
  reporter: [["list"]],
  use: { ...base.use, channel: "chrome", video: "off" },
  projects: base.projects.map((p) => ({
    ...p,
    use: { ...p.use, channel: "chrome" },
  })),
};
