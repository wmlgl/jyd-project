import { createSSRApp } from "vue";
import UniTransition from "@dcloudio/uni-ui/lib/uni-transition/uni-transition.vue";
import App from "./App.vue";

export function createApp() {
	const app = createSSRApp(App);
	app.component("uni-transition", UniTransition);
	return {
		app,
	};
}

// 注册Service Worker
if ("serviceWorker" in navigator && import.meta.env.PROD) {
	window.addEventListener("load", function () {
		navigator.serviceWorker
			.register(import.meta.env.BASE_URL + "static/sw.js")
			.then(function (registration) {
				console.log("SW registered: ", registration);
				registration.active?.postMessage({ type: "CHECK_FOR_UPDATE" });
			})
			.catch(function (registrationError) {
				console.log("SW registration failed: ", registrationError);
			});
	});
}
