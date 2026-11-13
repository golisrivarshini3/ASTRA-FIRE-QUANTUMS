import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: { extend: { colors: { ink: "#07111f", panel: "#101d30", line: "#20334b", cyan: "#50d7e8", muted: "#91a5bb" } } },
  plugins: []
};
export default config;
