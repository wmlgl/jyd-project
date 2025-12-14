<template>
	<view class="container">
		<!-- 页面标题区域 -->
		<view class="header-section">
			<view class="title-card">
				<text class="title">古诗文背诵</text>
				<text class="subtitle">让经典传承更简单</text>
			</view>
		</view>

		<!-- 内容区域 -->
		<view class="content-section">
			<scroll-view class="main-scroll" scroll-y>
				<!-- 功能模块区域 -->
				<view class="section">
					<text class="section-title">核心功能</text>
					<view class="card-grid">
						<view class="feature-card" @click="navigateTo('/pages/article-reading/article-reading')">
							<view class="card-icon">📖</view>
							<text class="card-title">文章阅读</text>
							<text class="card-desc">浏览和管理您的文章库</text>
						</view>
						
						<view class="feature-card" @click="continueReading()">
							<view class="card-icon">🔖</view>
							<text class="card-title">继续阅读</text>
							<text class="card-desc">回到上次阅读位置</text>
						</view>
						
						<view class="feature-card" @click="navigateTo('/pages/recitation-plan/recitation-plan')">
							<view class="card-icon">📝</view>
							<text class="card-title">背诵计划</text>
							<text class="card-desc">制定和管理背诵任务</text>
						</view>
						
						<view class="feature-card" @click="navigateTo('/pages/about/about')">
							<view class="card-icon">ℹ️</view>
							<text class="card-title">关于APP</text>
							<text class="card-desc">了解应用功能和使用方法</text>
						</view>
					</view>
				</view>

				<!-- 学习统计区域 -->
				<view class="section">
					<text class="section-title">学习统计</text>
					<view class="stats-card">
						<view class="stat-item">
							<text class="stat-value">{{ stats.articlesCount }}</text>
							<text class="stat-label">已读文章</text>
						</view>
						<view class="stat-item">
							<text class="stat-value">{{ stats.plansCount }}</text>
							<text class="stat-label">背诵计划</text>
						</view>
						<view class="stat-item">
							<text class="stat-value">{{ stats.accuracy }}%</text>
							<text class="stat-label">平均正确率</text>
						</view>
					</view>
				</view>

				<!-- 最近学习区域 -->
				<view class="section">
					<text class="section-title">最近学习</text>
					<view class="recent-list">
						<view v-for="record in recentRecords" :key="record.id" class="recent-item" @click="goToPlan(record.planId)">
							<view class="recent-content">
								<text class="recent-title">{{ record.planName }}</text>
								<text class="recent-info">{{ record.correct ? '背诵完成' : '背诵中' }} · {{ formatTime(record.time) }}</text>
							</view>
							<text class="recent-time">{{ formatRelativeTime(record.date) }}</text>
						</view>
						<view v-if="recentRecords.length === 0" class="empty-recent">
							<text class="empty-text">暂无学习记录</text>
						</view>
					</view>
				</view>
			</scroll-view>
		</view>

		<!-- 固定底部操作栏 -->
		<view class="fixed-bottom-bar">
			<view class="bottom-bar-container">
				<button class="main-action-btn" @click="navigateTo('/pages/recitation-plan/recitation-plan')">
					<text class="btn-text">开始学习</text>
				</button>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

// 定义统计数据接口
interface Stats {
	articlesCount: number;
	plansCount: number;
	accuracy: number;
}

// 定义最近学习记录接口
interface RecentRecord {
	id: string;
	planId: string;
	planName: string;
	correct: boolean;
	time: number;
	date: string;
}

const stats = ref<Stats>({
	articlesCount: 0,
	plansCount: 0,
	accuracy: 0
});

const recentRecords = ref<RecentRecord[]>([]);

const navigateTo = (path: string) => {
	uni.navigateTo({
		url: path,
	});
};

const continueReading = () => {
	const progress = uni.getStorageSync("readingProgress") || {};
	const articleIds = Object.keys(progress);

	if (articleIds.length > 0) {
		// 找到最近阅读的文章（基于时间戳）
		let latestArticle = null;
		let latestTime = 0;

		articleIds.forEach((id) => {
			const articleProgress = progress[id];
			if (articleProgress.timestamp && articleProgress.timestamp > latestTime) {
				latestTime = articleProgress.timestamp;
				latestArticle = { id, progress: articleProgress };
			}
		});

		if (latestArticle) {
			// 获取文章数据
			const articles = uni.getStorageSync("articles") || [];
			const article = articles.find((a: any) => a.id === latestArticle.id);

			if (article) {
				navigateTo(`/pages/article-detail/article-detail?id=${latestArticle.id}`);
			} else {
				uni.showToast({
					title: "文章数据不存在",
					icon: "none",
				});
			}
		} else {
			uni.showToast({
				title: "暂无阅读进度",
				icon: "none",
			});
		}
	} else {
		uni.showToast({
			title: "暂无阅读进度",
			icon: "none",
		});
	}
};

// 计算统计数据
const calculateStats = () => {
	// 计算已读文章数
	const articles = uni.getStorageSync("articles") || [];
	stats.value.articlesCount = articles.length;

	// 计算背诵计划数
	const plans = uni.getStorageSync("plans") || [];
	stats.value.plansCount = plans.length;

	// 计算平均正确率
	const records = uni.getStorageSync("recitationRecords") || [];
	if (records.length > 0) {
		const correctCount = records.filter((r: any) => r.correct).length;
		stats.value.accuracy = Math.round((correctCount / records.length) * 100);
	} else {
		stats.value.accuracy = 0;
	}
};

// 加载最近学习记录
const loadRecentRecords = () => {
	const records = uni.getStorageSync("recitationRecords") || [];
	const plans = uni.getStorageSync("plans") || [];
	
	// 获取最近的5条记录
	const recent = records
		.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
		.slice(0, 5)
		.map((record: any) => {
			// 查找对应的计划名称
			const plan = plans.find((p: any) => p.id === record.planId);
			return {
				id: `${record.planId}-${record.date}`,
				planId: record.planId,
				planName: plan ? plan.name : '未知计划',
				correct: record.correct,
				time: record.time,
				date: record.date
			};
		});
		
	recentRecords.value = recent;
};

// 格式化时间显示
const formatTime = (milliseconds: number) => {
	if (milliseconds < 1000) {
		return `${milliseconds}ms`;
	} else if (milliseconds < 60000) {
		return `${Math.round(milliseconds / 1000)}s`;
	} else {
		return `${Math.round(milliseconds / 60000)}m`;
	}
};

// 格式化相对时间显示
const formatRelativeTime = (dateString: string) => {
	const date = new Date(dateString);
	const now = new Date();
	const diff = now.getTime() - date.getTime();
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) {
		return '刚刚';
	} else if (minutes < 60) {
		return `${minutes}分钟前`;
	} else if (hours < 24) {
		return `${hours}小时前`;
	} else {
		return `${days}天前`;
	}
};

// 跳转到指定计划
const goToPlan = (planId: string) => {
	uni.navigateTo({
		url: `/pages/recitation-plan/recitation-plan`
	});
};

// 页面加载时初始化数据
onMounted(() => {
	calculateStats();
	loadRecentRecords();
});
</script>

<style lang="less" scoped>
.container {
	height: 100vh;
	display: flex;
	flex-direction: column;
	background-color: #f5f6f8;
	padding-bottom: 140rpx; /* 为底部固定栏留出空间 */
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

.section-title {
	font-size: 30rpx;
	font-weight: bold;
	color: #333;
	display: block;
	margin-bottom: 20rpx;
	padding-left: 10rpx;
}

/* 卡片网格布局 */
.card-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 20rpx;
}

.feature-card {
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
	padding: 30rpx 20rpx;
	text-align: center;
	transition: all 0.3s ease;
	cursor: pointer;
}

.feature-card:hover {
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.12);
	transform: translateY(-2rpx);
}

.card-icon {
	font-size: 48rpx;
	margin-bottom: 15rpx;
}

.card-title {
	font-size: 30rpx;
	font-weight: bold;
	color: #333;
	display: block;
	margin-bottom: 10rpx;
}

.card-desc {
	font-size: 24rpx;
	color: #999;
	display: block;
}

/* 统计卡片 */
.stats-card {
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
	padding: 30rpx 20rpx;
	display: flex;
	justify-content: space-around;
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

/* 最近学习列表 */
.recent-list {
	background: #ffffff;
	border-radius: 16rpx;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
	overflow: hidden;
}

.recent-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 30rpx 20rpx;
	border-bottom: 1rpx solid #f0f0f0;
	cursor: pointer;
}

.recent-item:last-child {
	border-bottom: none;
}

.recent-item:hover {
	background-color: #f9f9f9;
}

.recent-content {
	flex: 1;
}

.recent-title {
	font-size: 30rpx;
	color: #333;
	display: block;
	margin-bottom: 10rpx;
}

.recent-info {
	font-size: 24rpx;
	color: #999;
	display: block;
}

.recent-time {
	font-size: 24rpx;
	color: #ccc;
}

.empty-recent {
	padding: 40rpx;
	text-align: center;
}

.empty-text {
	font-size: 28rpx;
	color: #999;
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
	background: linear-gradient(90deg, #007aff, #00d4ff);
	color: white;
	padding: 20rpx 0;
	border-radius: 16rpx;
	font-size: 32rpx;
	font-weight: bold;
	border: none;
	box-shadow: 0 4rpx 16rpx rgba(0, 122, 255, 0.3);
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
</style>