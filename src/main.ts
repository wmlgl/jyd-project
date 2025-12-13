import { createSSRApp } from "vue";
import UniTransition from '@dcloudio/uni-ui/lib/uni-transition/uni-transition.vue';
import App from "./App.vue";

export function createApp() {
	const app = createSSRApp(App);
	app.component('uni-transition', UniTransition)
	return {
		app,
	};
}
