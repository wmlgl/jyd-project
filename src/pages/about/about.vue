<template>
	<view class="container">
		<!-- 内容区域 -->
		<view class="content-section">
			<scroll-view class="main-scroll" scroll-y>
				<!-- 页面标题区域 -->
				<view class="header-section">
					<view class="title-card">
						<text class="title">关于应用</text>
						<text class="subtitle">趣味古文诗词背诵学习工具</text>
					</view>
				</view>

				<!-- 应用信息卡片 -->
				<view class="info-card">
					<view class="app-icon"><img src="/static/icons/icon-144x144.svg" /></view>
					<view class="app-info">
						<text class="app-name">记忆点</text>
						<text class="app-version">版本 0.0.1</text>
						<text class="app-description">基于uni-app的开源本地应用</text>
					</view>
				</view>

				<!-- 功能特性区域 -->
				<view class="section">
					<view class="section-header">
						<text class="section-title">核心功能</text>
						<text class="section-subtitle">四大模块助力高效学习</text>
					</view>

					<view class="features-grid">
						<view class="feature-card">
							<view class="feature-icon">📖</view>
							<text class="feature-title">文章阅读</text>
							<text class="feature-desc">从GitHub Pages读取文章，支持目录过滤、继续阅读和书签功能</text>
						</view>

						<view class="feature-card">
							<view class="feature-icon">📋</view>
							<text class="feature-title">背诵计划</text>
							<text class="feature-desc">管理个性化背诵计划，支持添加文章或段落</text>
						</view>

						<view class="feature-card">
							<view class="feature-icon">🧩</view>
							<text class="feature-title">智能背诵</text>
							<text class="feature-desc">词语拆分排序，拼音首字母输入，难度分级隐藏</text>
						</view>

						<view class="feature-card">
							<view class="feature-icon">📊</view>
							<text class="feature-title">学习分析</text>
							<text class="feature-desc">遗忘曲线分析，正确率统计，学习效果评估</text>
						</view>
					</view>
				</view>

				<!-- 使用说明区域 -->
				<view class="section">
					<view class="section-header">
						<text class="section-title">使用指南</text>
						<text class="section-subtitle">快速上手，高效学习</text>
					</view>

					<view class="steps-list">
						<view class="step-item">
							<view class="step-number">1</view>
							<view class="step-content">
								<text class="step-title">创建背诵计划</text>
								<text class="step-desc">在"背诵计划"页面创建您的专属学习计划</text>
							</view>
						</view>

						<view class="step-item">
							<view class="step-number">2</view>
							<view class="step-content">
								<text class="step-title">选择难度级别</text>
								<text class="step-desc">根据您的水平设置合适的背诵难度</text>
							</view>
						</view>

						<view class="step-item">
							<view class="step-number">3</view>
							<view class="step-content">
								<text class="step-title">开始背诵练习</text>
								<text class="step-desc">通过拼音首字母输入，排列词语顺序</text>
							</view>
						</view>

						<view class="step-item">
							<view class="step-number">4</view>
							<view class="step-content">
								<text class="step-title">查看学习效果</text>
								<text class="step-desc">分析背诵结果，优化学习策略</text>
							</view>
						</view>
					</view>
				</view>

				<!-- 开发者信息区域 -->
				<view class="section">
					<view class="developer-card">
						<text class="dev-title">💻 开发者信息</text>
						<view class="dev-links">
							<text class="dev-link" @click="openGitHub">GitHub 仓库</text>
							<text class="dev-link" @click="sendFeedback">问题反馈</text>
							<text class="dev-link" @click="showDonate">支持开发者</text>
						</view>
					</view>
				</view>
			</scroll-view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { onLoad } from "@dcloudio/uni-app";

const openGitHub = () => {
	uni.showModal({
		title: "GitHub 仓库",
		content: "即将打开项目GitHub页面",
		confirmText: "确定",
		cancelText: "取消",
		success: (res) => {
			if (res.confirm) {
				uni.navigateTo({
					url: "https://github.com/wmlgl/jyd-project"
				});
			}
		}
	});
};

const sendFeedback = () => {
	uni.showModal({
		title: "Gitee Issues 页面",
		content: "即将打开项目Issues页面",
		confirmText: "确定",
		cancelText: "取消",
		success: (res) => {
			if (res.confirm) {
				uni.navigateTo({
					url: "https://gitee.com/wmlgl/jyd-project/issues"
				});
			}
		}
	})
};

const showDonate = () => {
	uni.showModal({
		title: "支持开发者",
		content: "感谢您的支持！开发不易，您的鼓励是我前进的动力。\n\n请选择支付方式：",
		confirmText: "支付宝",
		cancelText: "微信支付",
		success: (res) => {
			if (res.confirm) {
				// 显示支付宝二维码
				uni.previewImage({
					urls: ['/static/alipay.png']
				});
			} else if (res.cancel) {
				// 显示微信支付二维码
				uni.previewImage({
					urls: ['/static/wxpay.png']
				});
			}
		}
	});
};

onLoad(() => {
	console.log("关于页面加载完成");
});
</script>

<style lang="less" scoped>
.container {
	min-height: 100vh;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	padding: 20rpx;
}

.header-section {
	margin-bottom: 40rpx;
}

.title-card {
	background: rgba(255, 255, 255, 0.95);
	border-radius: 24rpx;
	padding: 40rpx;
	box-shadow: 0 8rpx 32rpx rgba(0, 0, 0, 0.1);
	backdrop-filter: blur(10rpx);

	.title {
		display: block;
		font-size: 48rpx;
		font-weight: bold;
		color: #333;
		margin-bottom: 16rpx;
	}

	.subtitle {
		display: block;
		font-size: 28rpx;
		color: #666;
	}
}

.content-section {
	flex: 1;
}

.main-scroll {
	height: calc(100vh - 240rpx);
}

.info-card {
	background: rgba(255, 255, 255, 0.95);
	border-radius: 20rpx;
	padding: 40rpx;
	margin-bottom: 40rpx;
	box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.08);
	display: flex;
	align-items: center;
	gap: 32rpx;

	.app-icon {
		font-size: 80rpx;

		img {
			height: 80px;
		}
	}

	.app-info {
		flex: 1;

		.app-name {
			display: block;
			font-size: 36rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 8rpx;
		}

		.app-version {
			display: block;
			font-size: 24rpx;
			color: #666;
			margin-bottom: 4rpx;
		}

		.app-description {
			display: block;
			font-size: 24rpx;
			color: #888;
		}
	}
}

.section {
	margin-bottom: 40rpx;
}

.section-header {
	margin-bottom: 32rpx;

	.section-title {
		display: block;
		font-size: 32rpx;
		font-weight: bold;
		color: white;
		margin-bottom: 8rpx;
	}

	.section-subtitle {
		display: block;
		font-size: 24rpx;
		color: rgba(255, 255, 255, 0.8);
	}
}

.features-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 24rpx;
}

.feature-card {
	background: rgba(255, 255, 255, 0.95);
	border-radius: 16rpx;
	padding: 32rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);

	.feature-icon {
		font-size: 48rpx;
		margin-bottom: 16rpx;
	}

	.feature-title {
		display: block;
		font-size: 26rpx;
		font-weight: bold;
		color: #333;
		margin-bottom: 8rpx;
	}

	.feature-desc {
		display: block;
		font-size: 22rpx;
		color: #666;
		line-height: 1.4;
	}
}

.steps-list {
	background: rgba(255, 255, 255, 0.95);
	border-radius: 16rpx;
	padding: 32rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.step-item {
	display: flex;
	align-items: flex-start;
	gap: 24rpx;
	margin-bottom: 32rpx;

	&:last-child {
		margin-bottom: 0;
	}

	.step-number {
		width: 60rpx;
		height: 60rpx;
		background: linear-gradient(135deg, #667eea, #764ba2);
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: white;
		font-size: 24rpx;
		font-weight: bold;
		flex-shrink: 0;
	}

	.step-content {
		flex: 1;

		.step-title {
			display: block;
			font-size: 26rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 8rpx;
		}

		.step-desc {
			display: block;
			font-size: 22rpx;
			color: #666;
			line-height: 1.4;
		}
	}
}

.developer-card {
	background: rgba(255, 255, 255, 0.95);
	border-radius: 16rpx;
	padding: 32rpx;
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);

	.dev-title {
		display: block;
		font-size: 28rpx;
		font-weight: bold;
		color: #333;
		margin-bottom: 24rpx;
	}

	.dev-links {
		display: flex;
		flex-direction: column;
		gap: 16rpx;
	}

	.dev-link {
		display: block;
		font-size: 24rpx;
		color: #667eea;
		padding: 20rpx;
		background: rgba(102, 126, 234, 0.1);
		border-radius: 12rpx;
		text-align: center;
		transition: all 0.3s ease;

		&:active {
			background: rgba(102, 126, 234, 0.2);
			transform: scale(0.98);
		}
	}
}

// 响应式设计
@media (max-width: 750rpx) {
	.features-grid {
		grid-template-columns: 1fr;
	}

	.container {
		padding: 16rpx;
	}

	.title-card {
		padding: 32rpx;
	}
}
</style>