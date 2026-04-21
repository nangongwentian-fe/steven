import DefaultTheme from "vitepress/theme";
import type { Theme } from "vitepress";
import MermaidBlock from "./MermaidBlock.vue";

const theme: Theme = {
	extends: DefaultTheme,
	enhanceApp(ctx) {
		DefaultTheme.enhanceApp?.(ctx);
		ctx.app.component("MermaidBlock", MermaidBlock);
	},
};

export default theme;
