<template>
	<view class="content">
		<view class="menu">
			<view class="button" @click="navigateTo('/pages/article-reading/article-reading')">
				<text class="text">文章阅读</text>
			</view>
			<view class="button" @click="continueReading()">
				<text class="text">继续阅读</text>
			</view>
			<view class="button" @click="navigateTo('/pages/recitation-plan/recitation-plan')">
				<text class="text">背诵计划</text>
			</view>
			<view class="button" @click="navigateTo('/pages/about/about')">
				<text class="text">关于APP</text>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
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
</script>

<style lang="less" scoped>
.content {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
}

.menu {
	display: flex;
	flex-direction: column;
	align-items: center;
	margin-top: 100rpx;
}

.button {
	background-color: #007aff;
	color: white;
	padding: 20rpx 40rpx;
	margin: 20rpx;
	border-radius: 10rpx;
	text-align: center;
	min-width: 200rpx;
}
</style>
