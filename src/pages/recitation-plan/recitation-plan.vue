<template>
	<view class="container">
		<!-- 页面标题区域 -->
		<view class="header-section">
			<view class="title-card">
				<text class="title">背诵计划</text>
				<text class="subtitle">管理和创建您的专属背诵计划</text>
			</view>
		</view>

		<!-- 内容区域 -->
		<view class="content-section">
			<scroll-view class="main-scroll" scroll-y>
				<!-- 统计信息卡片 -->
				<view class="stats-card">
					<view class="stat-item">
						<text class="stat-value">{{ plans.length }}</text>
						<text class="stat-label">计划总数</text>
					</view>
					<view class="stat-item">
						<text class="stat-value">{{ getTotalItems() }}</text>
						<text class="stat-label">项目总数</text>
					</view>
					<view class="stat-item">
						<text class="stat-value">{{ getCompletedPlans() }}</text>
						<text class="stat-label">已完成</text>
					</view>
				</view>

				<!-- 计划列表区域 -->
				<view class="section">
					<view class="section-header">
						<text class="section-title">我的计划</text>
						<text class="section-subtitle">点击计划开始背诵</text>
					</view>

					<view v-if="plans.length === 0" class="empty-state">
						<text class="empty-icon">📝</text>
						<text class="empty-text">暂无背诵计划</text>
						<text class="empty-hint">点击下方按钮创建您的第一个计划</text>
					</view>

					<view v-else class="plans-list">
						<view v-for="plan in plans" :key="plan.id" class="plan-card" @click="startRecitation(plan)"
							@longpress="showPlanMenu(plan)">
							<view class="plan-header">
								<text class="plan-name">{{ plan.name }}</text>
								<view class="plan-status" :class="getPlanStatusClass(plan)">
									<text class="status-text">{{ getPlanStatusText(plan) }}</text>
								</view>
							</view>

							<view class="plan-details">
								<view class="detail-item">
									<text class="detail-label">项目数</text>
									<text class="detail-value">{{ plan.items.length }}</text>
								</view>
								<view class="detail-item">
									<text class="detail-label">创建时间</text>
									<text class="detail-value">{{ formatDate(plan.id) }}</text>
								</view>
							</view>

							<view class="plan-progress">
								<view class="progress-bar">
									<view class="progress-fill" :style="{ width: getPlanProgress(plan) + '%' }"></view>
								</view>
								<text class="progress-text">{{ getPlanProgress(plan) }}%</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 学习建议区域 -->
				<view class="section">
					<view class="tips-card">
						<text class="tips-title">💡 学习建议</text>
						<text class="tips-content">制定合理的背诵计划，每天坚持练习，有助于提高记忆效果。</text>
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 固定底部操作栏 -->
		<view class="fixed-bottom-bar">
			<view class="bottom-bar-container">
				<button class="main-action-btn" @click="createPlan">
					<text class="btn-icon">+</text>
					<text class="btn-text">新建计划</text>
				</button>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";

interface PlanItem {
	type: "article" | "paragraph";
	content: string;
	completed?: boolean;
}

interface Plan {
	id: string;
	name: string;
	items: PlanItem[];
	createTime: string;
	lastStudyTime?: string;
}

const plans = ref<Plan[]>([]);

const loadPlans = () => {
	// 从本地存储加载计划数据
	const storedPlans = uni.getStorageSync("plans") || [];

	// 如果没有计划数据，则创建示例数据
	if (storedPlans.length === 0) {
		plans.value = [
			{
				id: "1",
				name: "唐诗三百首",
				items: [
					{ type: "paragraph", content: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。", completed: true },
					{ type: "paragraph", content: "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。", completed: false }
				],
				createTime: "2023-05-15",
				lastStudyTime: "2023-05-20"
			},
			{
				id: "2",
				name: "宋词精选",
				items: [
					{ type: "paragraph", content: "明月几时有？把酒问青天。不知天上宫阙，今夕是何年。", completed: false },
					{ type: "paragraph", content: "大江东去，浪淘尽，千古风流人物。故垒西边，人道是，三国周郎赤壁。", completed: false }
				],
				createTime: "2023-05-18"
			}
		];
		uni.setStorageSync("plans", plans.value);
	} else {
		plans.value = storedPlans;
	}
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

// 计算总项目数
const getTotalItems = () => {
	return plans.value.reduce((total, plan) => total + plan.items.length, 0);
};

// 计算已完成的计划数
const getCompletedPlans = () => {
	return plans.value.filter(plan =>
		plan.items.every(item => item.completed)
	).length;
};

// 修改：学习进度存储键名（基于计划ID）
const getProgressKey = (plan: Plan) => `learningProgress_${plan.id}`;

// 新增：判断计划是否已完成
const isPlanCompleted = (plan: Plan) => {
	let prog = uni.getStorageSync(getProgressKey(plan));
	if (!prog) return false;
	return prog.currentSentenceIndex === prog.totalSentences;
};

// 判断计划是否处于活跃状态（有学习记录）
const isPlanActive = (plan: Plan) => {
	let prog = uni.getStorageSync(getProgressKey(plan));
	return prog;
};

// 新增：获取计划状态文本
const getPlanStatusText = (plan: Plan) => {
	if (isPlanCompleted(plan)) {
		return '已完成';
	} else if (isPlanActive(plan)) {
		return '进行中';
	} else {
		return '未开始';
	}
};

// 新增：获取计划状态类名
const getPlanStatusClass = (plan: Plan) => {
	if (isPlanCompleted(plan)) {
		return 'status-completed';
	} else if (isPlanActive(plan)) {
		return 'status-active';
	} else {
		return '';
	}
};

// 计算计划完成进度
const getPlanProgress = (plan: Plan) => {
	let prog = uni.getStorageSync(getProgressKey(plan));
	return prog ? Math.round(prog.currentSentenceIndex / prog.totalSentences * 100) : 0;
};

// 格式化日期显示
const formatDate = (dateString: string) => {
	if (!dateString) return "未知";
	const date = new Date(+dateString > 0 ? +dateString : dateString);
	const now = new Date();
	const diffTime = Math.abs(now.getTime() - date.getTime());
	const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

	if (diffDays === 0) return "今天";
	if (diffDays === 1) return "昨天";
	if (diffDays < 7) return `${diffDays}天前`;

	return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
};

onLoad(() => {
	loadPlans();
});

// 新增：页面显示时刷新列表
onShow(() => {
	loadPlans();
});
</script>

<style lang="less" scoped>
.container {
	height: 100vh;
	display: flex;
	flex-direction: column;
	background-color: #f5f6f8;
	padding-bottom: 140rpx;
	/* 为底部固定栏留出空间 */
}

/* 标题区域样式 */
.header-section {
	padding: 20rpx;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.1);
}

.title-card {
	background: transparent;
	border-radius: 16rpx;
	padding: 30rpx 20rpx;
	text-align: center;
}

.title {
	font-size: 36rpx;
	font-weight: bold;
	color: white;
	line-height: 1.4;
	display: block;
}

.subtitle {
	font-size: 28rpx;
	color: rgba(255, 255, 255, 0.9);
	line-height: 1.4;
	display: block;
	margin-top: 10rpx;
}

/* 内容区域样式 */
.content-section {
	flex: 1;
	padding: 20rpx;
	overflow: hidden;
}

.main-scroll {
	height: 100%;
}

.section {
	margin-bottom: 30rpx;
}

.section-header {
	margin-bottom: 20rpx;
	padding-left: 10rpx;
}

.section-title {
	font-size: 32rpx;
	font-weight: bold;
	color: #333;
	display: block;
}

.section-subtitle {
	font-size: 26rpx;
	color: #999;
	display: block;
	margin-top: 8rpx;
}

/* 统计卡片 */
.stats-card {
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
	padding: 30rpx 20rpx;
	display: flex;
	justify-content: space-around;
	margin-bottom: 30rpx;
}

.stat-item {
	text-align: center;
}

.stat-value {
	font-size: 36rpx;
	font-weight: bold;
	color: #007aff;
	display: block;
	margin-bottom: 10rpx;
}

.stat-label {
	font-size: 24rpx;
	color: #999;
	display: block;
}

/* 计划卡片 */
.plans-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.plan-card {
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
	padding: 30rpx 20rpx;
	transition: all 0.3s ease;
	cursor: pointer;
}

.plan-card:hover {
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.12);
	transform: translateY(-2rpx);
}

.plan-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 20rpx;
}

.plan-name {
	font-size: 32rpx;
	font-weight: bold;
	color: #333;
	flex: 1;
}

.plan-status {
	background-color: #f0f0f0;
	color: #999;
	padding: 6rpx 16rpx;
	border-radius: 20rpx;
	font-size: 24rpx;
}

.plan-status.status-active {
	background: linear-gradient(90deg, #007aff, #00d4ff);
	color: white;
}

.plan-details {
	display: flex;
	justify-content: space-between;
	margin-bottom: 20rpx;
}

.detail-item {
	display: flex;
	flex-direction: column;
}

.detail-label {
	font-size: 24rpx;
	color: #999;
	margin-bottom: 6rpx;
}

.detail-value {
	font-size: 28rpx;
	color: #333;
	font-weight: 500;
}

/* 进度条 */
.plan-progress {
	display: flex;
	align-items: center;
}

.progress-bar {
	flex: 1;
	height: 12rpx;
	background-color: #f0f0f0;
	border-radius: 6rpx;
	overflow: hidden;
	margin-right: 20rpx;
}

.progress-fill {
	height: 100%;
	background: linear-gradient(90deg, #007aff, #00d4ff);
	border-radius: 6rpx;
	transition: width 0.3s ease;
}

.progress-text {
	font-size: 24rpx;
	color: #999;
	min-width: 60rpx;
	text-align: right;
}

/* 空状态 */
.empty-state {
	text-align: center;
	padding: 80rpx 40rpx;
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
}

.empty-icon {
	font-size: 120rpx;
	display: block;
	margin-bottom: 20rpx;
}

.empty-text {
	font-size: 32rpx;
	color: #666;
	margin-bottom: 12rpx;
	display: block;
}

.empty-hint {
	font-size: 26rpx;
	color: #999;
}

/* 学习建议卡片 */
.tips-card {
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
	padding: 30rpx 20rpx;
}

.tips-title {
	font-size: 30rpx;
	font-weight: bold;
	color: #333;
	display: block;
	margin-bottom: 15rpx;
}

.tips-content {
	font-size: 26rpx;
	color: #666;
	line-height: 1.5;
}

/* 固定底部操作栏 */
.fixed-bottom-bar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 20rpx;
	background: #ffffff;
	box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.1);
	z-index: 999;
}

.bottom-bar-container {
	max-width: 750rpx;
	margin: 0 auto;
}

.main-action-btn {
	width: 100%;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: white;
	padding: 20rpx 0;
	border-radius: 16rpx;
	font-size: 32rpx;
	font-weight: bold;
	border: none;
	box-shadow: 0 4rpx 16rpx rgba(102, 126, 234, 0.3);
	display: flex;
	align-items: center;
	justify-content: center;
}

.btn-icon {
	font-size: 36rpx;
	margin-right: 12rpx;
}

.btn-text {
	display: block;
}

/* 响应式设计 */
@media (min-width: 768px) {
	.container {
		max-width: 750rpx;
		margin: 0 auto;
	}

	.header-section {
		border-radius: 0 0 16rpx 16rpx;
	}

	.fixed-bottom-bar {
		max-width: 750rpx;
		left: 50%;
		transform: translateX(-50%);
	}
}

.plan-status.status-completed {
	background: linear-gradient(90deg, #4CAF50, #8BC34A);
	color: white;
}

.plan-status.status-active {
	background: linear-gradient(90deg, #007aff, #00d4ff);
	color: white;
}
</style>