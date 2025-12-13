<template>
	<view>
		<text>背诵计划</text>
		<button @click="createPlan">创建计划</button>
		<text>计划数: {{ plans.length }}</text>
		<view v-for="plan in plans" :key="plan.id">
			<view @click="startRecitation(plan)" @longpress="showPlanMenu(plan)">
				<text>{{ plan.name }}</text>
				<text>项目数: {{ plan.items.length }}</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface Plan {
	id: string;
	name: string;
	items: { type: "article" | "paragraph"; content: string }[];
}

const plans = ref<Plan[]>([]);

const loadPlans = () => {
	plans.value = uni.getStorageSync("plans") || [{ id: "1", name: "计划1", items: [{ type: "paragraph", content: "这是一个测试段落。" }] }];
};

const createPlan = () => {
	uni.navigateTo({
		url: "/pages/plan-edit/plan-edit",
	});
};

const startRecitation = (plan: Plan) => {
	uni.navigateTo({
		url: `/pages/recitation/recitation?planId=${plan.id}`,
	});
};

const showPlanMenu = (plan: Plan) => {
	uni.showActionSheet({
		itemList: ["编辑", "删除"],
		success: (res) => {
			if (res.tapIndex === 0) {
				editPlan(plan);
			} else if (res.tapIndex === 1) {
				deletePlan(plan);
			}
		},
	});
};

const editPlan = (plan: Plan) => {
	uni.navigateTo({
		url: `/pages/plan-edit/plan-edit?id=${plan.id}`,
	});
};

const deletePlan = (plan: Plan) => {
	uni.showModal({
		title: "确认删除",
		content: `确定删除计划"${plan.name}"吗？`,
		success: (res) => {
			if (res.confirm) {
				const index = plans.value.findIndex((p) => p.id === plan.id);
				if (index !== -1) {
					plans.value.splice(index, 1);
					uni.setStorageSync("plans", plans.value);
					uni.showToast({ title: "删除成功", icon: "success" });
				}
			}
		},
	});
};

onMounted(() => {
	loadPlans();
});
</script>
