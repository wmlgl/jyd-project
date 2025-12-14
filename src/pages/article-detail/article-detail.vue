<template>
	<view class="article-page">
		<!-- 全屏容器 -->
		<view class="container">
			<!-- 文章标题区域 -->
			<view class="header-section">
				<view class="title-card">
					<text class="title">{{ title }}</text>
				</view>
			</view>

			<!-- 文章内容区域 -->
			<view class="content-section">
				<scroll-view 
					class="content-scroll" 
					scroll-y 
					:scroll-top="scrollTop" 
					@scroll="onScroll"
					@scrolltolower="loadMoreParagraphs"
					@touchstart="handleTouchStart"
					@touchmove="handleTouchMove"
					@touchend="handleTouchEnd"
					enable-back-to-top="true">
					
					<view class="content-wrapper">
						<view v-for="(paragraph, index) in visibleParagraphs" :key="index" class="paragraph-card">
							<text class="paragraph-text">{{ paragraph }}</text>
						</view>

						<view v-if="isLoading" class="loading-card">
							<text class="loading-text">加载中...</text>
						</view>

						<view v-if="currentIndex >= paragraphs.length && visibleParagraphs.length > 0" class="end-card">
							<text class="end-text">已到文章结尾</text>
						</view>

						<!-- 底部间距 -->
						<view class="content-footer-spacing"></view>
					</view>
				</scroll-view>
			</view>
		</view>

		<!-- 字数统计和位置信息（使用fixed定位，贴在底部按钮上方） -->
		<view class="position-info-fixed">
			<text class="position-text">当前位置: {{ currentPosition }}/{{ totalWords }}</text>
		</view>

		<!-- 固定底部工具栏 -->
		<view class="fixed-toolbar">
			<view class="toolbar-container">
				<!-- 书签操作卡片 -->
				<view class="toolbar-card">
					<view class="toolbar-item" @click="toggleBookmark">
						<text class="item-icon">{{ isBookmarked ? '★' : '☆' }}</text>
						<text class="item-label">{{ isBookmarked ? '已收藏' : '收藏' }}</text>
					</view>

					<view class="toolbar-item" @click="viewBookmarks" v-if="isBookmarked">
						<text class="item-icon">🔖</text>
						<text class="item-label">书签</text>
					</view>

					<view class="toolbar-item" @click="saveProgress">
						<text class="item-icon">💾</text>
						<text class="item-label">保存</text>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";

const title = ref("");
const content = ref("");
const articleId = ref("");
const scrollTop = ref(0);
const isBookmarked = ref(false);
const bookmarks = ref<any[]>([]);
const refreshing = ref(false);

// 字数统计相关
const totalWords = ref(0);
const currentPosition = ref(0);

// 懒加载相关
const paragraphs = ref<string[]>([]);
const visibleParagraphs = ref<string[]>([]);
const currentIndex = ref(0);
const pageSize = 10; // 每次加载的段落数
const isLoading = ref(false);
const maxVisibleParagraphs = 200; // 最大可见段落数，防止内存溢出

// 触摸事件相关
let startY = 0;
let endY = 0;
let isDragging = false;
let lastLoadTime = 0; // 防止频繁加载

// 防抖相关
let scrollTimer: any = null;

const loadArticle = () => {
	const articles = uni.getStorageSync("articles") || [];
	const article = articles.find((a: any) => a.id === articleId.value);
	if (article) {
		title.value = article.title;
		content.value = article.content;

		// 计算总字数（去除空格后的字符数）
		totalWords.value = content.value.replace(/\s/g, '').length;

		// 将内容按段落分割
		paragraphs.value = content.value.split("\n").filter((p) => p.trim().length > 0);

		// 初始加载适量段落
		const initialLoad = Math.min(15, paragraphs.value.length); // 初始加载15个段落
		visibleParagraphs.value = paragraphs.value.slice(0, initialLoad);
		currentIndex.value = initialLoad;

		// 强制触发一次滚动检查
		setTimeout(() => {
			checkAndLoadMore();
		}, 100);
	}
};

const loadBookmark = () => {
	const savedBookmarks = uni.getStorageSync("bookmarks") || [];
	bookmarks.value = savedBookmarks.filter((b: any) => b.articleId === articleId.value);
	isBookmarked.value = bookmarks.value.length > 0;
};

const loadProgress = () => {
	const progress = uni.getStorageSync("readingProgress") || {};
	const savedData = progress[articleId.value];

	if (savedData) {
		// 如果有保存的段落索引，加载到该位置
		if (savedData.paragraphIndex && savedData.paragraphIndex > 0) {
			currentIndex.value = Math.min(savedData.paragraphIndex + pageSize, paragraphs.value.length);
			visibleParagraphs.value = paragraphs.value.slice(0, currentIndex.value);
		}
		scrollTop.value = savedData.scrollTop || 0;
	}
};

const toggleBookmark = () => {
	uni.showModal({
		title: "添加书签",
		content: "",
		editable: true,
		placeholderText: "请输入书签名称",
		success: (res) => {
			if (res.confirm && res.content) {
				addBookmark(res.content);
			}
		},
	});
};

const addBookmark = (name: string) => {
	if (!name || !name.trim()) {
		uni.showToast({
			title: "书签名称不能为空",
			icon: "none",
		});
		return;
	}

	// 检查是否已存在同名书签
	const existingBookmark = bookmarks.value.find((b) => b.name === name.trim());
	if (existingBookmark) {
		uni.showToast({
			title: "书签名称已存在",
			icon: "none",
		});
		return;
	}

	const allBookmarks = uni.getStorageSync("bookmarks") || [];
	const newBookmark = {
		id: Date.now().toString(),
		articleId: articleId.value,
		name: name.trim(),
		scrollTop: scrollTop.value,
		paragraphIndex: currentIndex.value,
		createdAt: new Date().toISOString(),
	};
	allBookmarks.push(newBookmark);
	uni.setStorageSync("bookmarks", allBookmarks);
	loadBookmark();
	uni.showToast({
		title: "书签已添加",
		icon: "success",
	});
};

const viewBookmarks = () => {
	if (bookmarks.value.length === 0) {
		uni.showToast({
			title: "暂无书签",
			icon: "none",
		});
		return;
	}

	const bookmarkList = bookmarks.value.map((b, index) => `${index + 1}. ${b.name}`).join("\n");

	uni.showActionSheet({
		itemList: [...bookmarkList.split("\n"), "管理书签"],
		success: (res) => {
			if (res.tapIndex >= 0 && res.tapIndex < bookmarks.value.length) {
				// 跳转到书签位置
				const bookmark = bookmarks.value[res.tapIndex];
				
				// 设置滚动位置
				scrollTop.value = bookmark.scrollTop || 0;
				
				// 确保书签位置的段落已加载
				if (bookmark.paragraphIndex && bookmark.paragraphIndex > currentIndex.value) {
					currentIndex.value = Math.min(bookmark.paragraphIndex + pageSize, paragraphs.value.length);
					visibleParagraphs.value = paragraphs.value.slice(0, currentIndex.value);
				}
				
				// 延迟执行滚动以确保DOM更新完成
				setTimeout(() => {
					scrollTop.value = bookmark.scrollTop || 0;
				}, 100);
				
				uni.showToast({
					title: `已跳转到: ${bookmark.name}`,
					icon: "success",
				});
			} else if (res.tapIndex === bookmarks.value.length) {
				// 管理书签
				setTimeout(manageBookmarks, 300);
			}
		},
		fail: (err) => {
			console.log("删除操作取消", err);
		},
	});
};

const manageBookmarks = () => {
	if (bookmarks.value.length === 0) {
		uni.showToast({
			title: "暂无书签可管理",
			icon: "none",
		});
		return;
	}

	const bookmarkNames = bookmarks.value.map(b => b.name);
	uni.showActionSheet({
		itemList: [...bookmarkNames, "取消"],
		itemColor: "#333",
		success: (res) => {
			if (res.tapIndex >= 0 && res.tapIndex < bookmarks.value.length) {
				// 显示编辑选项
				const bookmark = bookmarks.value[res.tapIndex];
				uni.showActionSheet({
					itemList: ["重命名", "删除", "取消"],
					itemColor: "#333",
					success: (actionRes) => {
						switch (actionRes.tapIndex) {
							case 0: // 重命名
								renameBookmark(bookmark);
								break;
							case 1: // 删除
								deleteBookmark(bookmark);
								break;
						}
					}
				});
			}
		}
	});
};

const renameBookmark = (bookmark: any) => {
	uni.showModal({
		title: "重命名书签",
		content: "",
		editable: true,
		placeholderText: "请输入新的书签名称",
		success: (res) => {
			if (res.confirm && res.content) {
				const newName = res.content.trim();
				if (!newName) {
					uni.showToast({
						title: "书签名称不能为空",
						icon: "none",
					});
					return;
				}

				// 检查是否与其他书签重名
				const duplicate = bookmarks.value.find(b => b.id !== bookmark.id && b.name === newName);
				if (duplicate) {
					uni.showToast({
						title: "书签名称已存在",
						icon: "none",
					});
					return;
				}

				// 更新书签名称
				const allBookmarks = uni.getStorageSync("bookmarks") || [];
				const updatedBookmarks = allBookmarks.map((b: any) =>
					b.id === bookmark.id ? { ...b, name: newName } : b
				);
				uni.setStorageSync("bookmarks", updatedBookmarks);
				loadBookmark();
				uni.showToast({
					title: "书签已重命名",
					icon: "success",
				});
			}
		},
	});
};

const deleteBookmark = (bookmark: any) => {
	uni.showModal({
		title: "删除书签",
		content: `确定要删除书签 "${bookmark.name}" 吗？`,
		success: (res) => {
			if (res.confirm) {
				const allBookmarks = uni.getStorageSync("bookmarks") || [];
				const updatedBookmarks = allBookmarks.filter((b: any) => b.id !== bookmark.id);
				uni.setStorageSync("bookmarks", updatedBookmarks);
				loadBookmark();
				uni.showToast({
					title: "书签已删除",
					icon: "success",
				});
			}
		},
		fail: (err) => {
			console.log("删除操作取消", err);
		},
	});
};

const saveProgress = () => {
	const progress = uni.getStorageSync("readingProgress") || {};
	progress[articleId.value] = {
		scrollTop: scrollTop.value,
		paragraphIndex: currentIndex.value - pageSize, // 保存已加载的段落索引
		timestamp: Date.now(),
	};
	uni.setStorageSync("readingProgress", progress);
	uni.showToast({
		title: "进度已保存",
		icon: "success",
	});
};

// 处理触摸开始事件
const handleTouchStart = (e: any) => {
	startY = e.touches[0].pageY;
	isDragging = true;
};

// 处理触摸移动事件
const handleTouchMove = (e: any) => {
	if (!isDragging) return;

	endY = e.touches[0].pageY;
	const deltaY = endY - startY;

	// 更新当前位置
	// 注意：这里我们只能估算，因为触摸事件中无法获取真实的滚动位置
	// 我们假设用户正在向下滚动，所以增加当前位置
	if (deltaY < 0) { // 向上滑动
		// 基于滑动距离估算新的滚动位置
		const estimatedScrollTop = scrollTop.value + Math.abs(deltaY);
		// 获取内容容器高度信息
		const query = uni.createSelectorQuery();
		query.select('.content-scroll').boundingClientRect((rect: any) => {
			if (rect) {
				const clientHeight = rect.height;
				// 估算内容总高度
				const estimatedContentHeight = visibleParagraphs.value.length * 30;
				// 计算当前位置
				calculateCurrentPosition(estimatedScrollTop, estimatedContentHeight, clientHeight);
			}
		}).exec();
	}

	// 如果是向上滑动（deltaY < 0）并且已经接近底部，则加载更多
	if (deltaY < 0) {
		// 添加时间限制，防止频繁触发
		const now = Date.now();
		if (now - lastLoadTime > 500) { // 500ms节流
			const scrollRatio = Math.abs(deltaY) / 100; // 根据滑动距离计算比例
			if (scrollRatio > 0.5) { // 当滑动比例大于0.5时触发加载
				loadMoreParagraphs();
				lastLoadTime = now;
			}
		}
	}
};

// 处理触摸结束事件
const handleTouchEnd = () => {
	isDragging = false;
	startY = 0;
	endY = 0;
};

const loadMoreParagraphs = () => {
	if (isLoading.value || currentIndex.value >= paragraphs.value.length) {
		return;
	}
	console.log("load more");

	// 检查是否超过最大可见段落数，如果是则清理旧内容
	if (visibleParagraphs.value.length >= maxVisibleParagraphs) {
		// 保留最近的段落，清理旧的
		const keepCount = Math.floor(maxVisibleParagraphs * 0.7); // 保留70%
		visibleParagraphs.value = visibleParagraphs.value.slice(-keepCount);
	}

	isLoading.value = true;

	// 使用requestAnimationFrame代替setTimeout，提高性能
	requestAnimationFrame(() => {
		const nextParagraphs = paragraphs.value.slice(currentIndex.value, currentIndex.value + pageSize);
		visibleParagraphs.value = [...visibleParagraphs.value, ...nextParagraphs];
		currentIndex.value += pageSize;
		isLoading.value = false;

		// 检查是否还需要加载更多
		setTimeout(() => {
			checkAndLoadMore();
		}, 50);
	});
};

// 检查是否需要加载更多内容
const checkAndLoadMore = () => {
	// 获取scroll-view的实际高度信息
	const query = uni.createSelectorQuery();
	query.select('.content-scroll').boundingClientRect((rect: any) => {
		if (rect) {
			const scrollViewHeight = rect.height;

			// 计算内容总高度（估算）
			const estimatedContentHeight = visibleParagraphs.value.length * 30; // 假设每段大约30px高度

			// 如果内容高度接近或超过视口高度，则检查是否需要加载更多
			if (estimatedContentHeight > scrollViewHeight * 0.8) {
				const distanceToBottom = estimatedContentHeight - scrollViewHeight - (scrollTop.value || 0);
				const shouldLoadMore = distanceToBottom < 200 || visibleParagraphs.value.length < 20;

				if (shouldLoadMore && !isLoading.value && currentIndex.value < paragraphs.value.length) {
					loadMoreParagraphs();
				}
			}
		}
	}).exec();
};

function calculateCurrentPosition(scrollTopVal, scrollHeight, clientHeight) {
	console.log('Calculating position:', { scrollTopVal, scrollHeight, clientHeight, totalWords: totalWords.value });

	// 如果没有内容，直接返回0
	if (totalWords.value <= 0) {
		currentPosition.value = 0;
		return;
	}

	// 如果内容高度小于等于容器高度，说明内容较少
	if (scrollHeight <= clientHeight) {
		// 在这种情况下，如果已经滚动了一些距离，应该根据滚动比例计算位置
		if (scrollTopVal > 0 && scrollHeight > 0) {
			const scrollRatio = scrollTopVal / scrollHeight;
			currentPosition.value = Math.round(totalWords.value * scrollRatio);
		} else {
			currentPosition.value = 0;
		}
		return;
	}

	// 正常情况下的计算：
	try {
		// 确保分母不为0
		const scrollableHeight = scrollHeight - clientHeight;
		if (scrollableHeight <= 0) {
			currentPosition.value = 0;
			return;
		}

		// 限制scrollTopVal的范围
		const clampedScrollTop = Math.max(0, Math.min(scrollTopVal, scrollableHeight));

		// 计算滚动的百分比
		const scrollRatio = clampedScrollTop / scrollableHeight;
		console.log('Scroll ratio:', scrollRatio);

		// 根据滚动百分比计算当前位置的字数
		const currentPositionValue = Math.round(totalWords.value * scrollRatio);
		console.log('Calculated position:', currentPositionValue);

		// 确保位置不会超过总字数，并且不小于0
		currentPosition.value = Math.max(0, Math.min(currentPositionValue, totalWords.value));
	} catch (error) {
		// 如果计算过程中出现错误，默认设置为0
		console.error('Error calculating position:', error);
		currentPosition.value = 0;
	}
}

// 修改 onScroll 函数以增加稳定性
const onScroll = (event: any) => {
	console.log('onScroll triggered:', event); // 添加日志以便调试

	// 确保event.detail存在
	if (!event || !event.detail) {
		console.warn('Invalid scroll event:', event);
		return;
	}

	const scrollTopVal = event.detail.scrollTop || 0;
	const scrollHeight = event.detail.scrollHeight || 0;
	const clientHeight = event.detail.clientHeight || 0;

	console.log('Scroll values:', { scrollTopVal, scrollHeight, clientHeight });

	// 检查必要的值是否存在
	if (scrollHeight <= 0 || clientHeight <= 0) {
		console.warn('Invalid scroll dimensions:', { scrollHeight, clientHeight });
		// 不要重置 currentPosition，保持当前值
		return;
	}

	scrollTop.value = scrollTopVal;

	// 计算当前位置
	calculateCurrentPosition(scrollTopVal, scrollHeight, clientHeight);

	// 防抖处理，避免频繁触发
	if (scrollTimer) {
		clearTimeout(scrollTimer);
	}

	scrollTimer = setTimeout(() => {
		// 检查是否需要加载更多内容
		if (!isLoading.value && currentIndex.value < paragraphs.value.length) {
			// 更精确的判断条件：距离底部一定距离时加载更多
			const distanceToBottom = scrollHeight - scrollTopVal - clientHeight;
			const shouldLoadMore = distanceToBottom < 200 || visibleParagraphs.value.length < 20;

			if (shouldLoadMore) {
				loadMoreParagraphs();
			}
		}
	}, 150); // 增加到150ms防抖
};

onLoad((query: any) => {
	articleId.value = query.id || "";
	loadArticle();
	loadBookmark();
	loadProgress();
});

onUnload(() => {
	saveProgress();
	// 清理定时器
	if (scrollTimer) {
		clearTimeout(scrollTimer);
	}
});
</script>

<style lang="less" scoped>
.article-page {
	height: 100vh;
	display: flex;
	flex-direction: column;
	background-color: #f0f2f5;
	position: relative;
}

.container {
	flex: 1;
	display: flex;
	flex-direction: column;
	padding: 20rpx;
	padding-bottom: 240rpx; /* 为底部工具栏和位置信息留出空间 */
	background: #fff;
}

/* 标题区域样式 */
.header-section {
	margin-bottom: 20rpx;
}

.title-card {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	border-radius: 16rpx;
	padding: 30rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
	color: white;
}

.title {
	font-size: 36rpx;
	font-weight: bold;
	line-height: 1.4;
	display: block;
	margin-bottom: 10rpx;
}

/* 内容区域样式 */
.content-section {
	flex: 1;
	margin-bottom: 20rpx;
}

.content-scroll {
	height: 100%;
}

.content-wrapper {
	padding: 10rpx 0;
}

.paragraph-card {
	background: #ffffff;
	border-radius: 16rpx;
	padding: 30rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
	transition: box-shadow 0.3s ease;
}

.paragraph-card:hover {
	box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.1);
}

.paragraph-text {
	font-size: 32rpx;
	line-height: 1.7;
	color: #333;
	text-align: justify;
}

.loading-card, .end-card {
	background: #ffffff;
	border-radius: 16rpx;
	padding: 30rpx;
	text-align: center;
	margin-bottom: 20rpx;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.loading-text, .end-text {
	font-size: 28rpx;
	color: #999;
}

.content-footer-spacing {
	height: 40rpx;
}

/* 步骤引导区域 */
.steps-section {
	background: #ffffff;
	border-radius: 16rpx;
	padding: 20rpx;
	box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.05);
	margin-bottom: 20rpx;
}

.step-indicator {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.step-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	flex: 1;
}

.step-item.active .step-number {
	background: #007aff;
	color: white;
}

.step-number {
	width: 50rpx;
	height: 50rpx;
	border-radius: 50%;
	background: #e0e0e0;
	display: flex;
	align-items: center;
	justify-content: center;
	font-weight: bold;
	margin-bottom: 10rpx;
}

.step-label {
	font-size: 24rpx;
	color: #666;
}

.step-divider {
	flex: 1;
	height: 2rpx;
	background: #e0e0e0;
	margin: 0 20rpx;
}

/* 位置信息样式（使用fixed定位） */
.position-info-fixed {
	position: fixed;
	bottom: 160rpx; /* 贴在底部按钮上方 */
	left: 0;
	right: 0;
	padding: 0 20rpx;
	z-index: 998;
	background: #fff;
	box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.1);
}

.position-info-fixed .position-text {
	background: #ffffff;
	border-radius: 16rpx;
	padding: 20rpx;
	font-size: 24rpx;
	color: #666;
	display: inline-block;
	margin-left: auto;
}

/* 固定底部工具栏 */
.fixed-toolbar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 20rpx;
	background: #ffffff;
	z-index: 999;
}

.toolbar-container {
	max-width: 750rpx;
	margin: 0 auto;
}

.toolbar-card {
	background: linear-gradient(90deg, #007aff, #00d4ff);
	border-radius: 16rpx;
	padding: 20rpx;
	display: flex;
	justify-content: space-around;
	box-shadow: 0 4rpx 16rpx rgba(0, 122, 255, 0.3);
}

.toolbar-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex: 1;
	padding: 10rpx;
}

.item-icon {
	font-size: 36rpx;
	margin-bottom: 5rpx;
}

.item-label {
	font-size: 24rpx;
	color: white;
}

/* 响应式设计 */
@media (min-width: 768px) {
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 30rpx;
		padding-bottom: 240rpx;
	}
	
	.title-card {
		padding: 40rpx;
	}
	
	.paragraph-card {
		padding: 40rpx;
	}
	
	.toolbar-card {
		padding: 30rpx;
	}
	
	.position-info-fixed {
		max-width: 800px;
		margin: 0 auto;
		left: 50%;
		transform: translateX(-50%);
	}
}
</style>