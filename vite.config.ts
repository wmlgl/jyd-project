import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";
import vueJsx from "@vitejs/plugin-vue-jsx";
import autoImport from "unplugin-auto-import/vite";
import components from "unplugin-vue-components/vite";
import fs from "fs";

const scanComponents: string[] = [];
fs.readdirSync("./src/components").forEach((file) => {
	if (file.endsWith(".vue")) {
		scanComponents.push(file.slice(0, -4));
	}
});

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		// @ts-ignore
		uni.default(),
		components({
			dts: true,
			resolvers: [
				(componentName) => {
					console.log("componentName", componentName);
					if (/^Uni/.test(componentName)) {
						const kebabName = componentName.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).slice(1);
						return { name: "default", from: "@dcloudio/uni-ui/lib/" + kebabName + "/" + kebabName + ".vue" };
					}
					if (scanComponents.includes(componentName)) return { name: componentName, from: "@/components" };
				},
			],
		}),
		autoImport({
			imports: ["vue"],
		}),
		vueJsx({}),
	],
	css: {
		// 配置 CSS Modules
		modules: {
			// 类名生成规则（可选，默认哈希）
			generateScopedName: "[name]__[local]___[hash:base64:5]",
			// 允许在 Less 中使用 camelCase 类名（如 .cardTitle → styles.cardTitle）
			localsConvention: "camelCaseOnly",
		},
		// Less 预处理器配置
		preprocessorOptions: {
			less: {
				javascriptEnabled: true,
			},
		},
	},
	// 修复构建配置
	build: {
		target: "es2022",
	},
	// 配置 esbuild 选项
	esbuild: {
		target: "es2022",
	},
	// 配置优化选项
	optimizeDeps: {
		esbuildOptions: {
			target: "es2022",
		},
	},
});
