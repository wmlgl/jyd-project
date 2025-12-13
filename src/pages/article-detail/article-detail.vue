<template>
	<view class="article-container">
		<!-- 文章标题区域 -->
		<view class="header">
			<text class="title">{{ title }}</text>
		</view>
		
		<!-- 文章内容区域 -->
		<scroll-view 
			class="content" 
			scroll-y="true" 
			:scroll-top="scrollTop" 
			@scroll="onScroll" 
			:scroll-with-animation="false"
		>
			<view v-for="(paragraph, index) in visibleParagraphs" :key="index" class="paragraph">
				<text>{{ paragraph }}</text>
			</view>
			
			<view v-if="isLoading" class="loading">
				<text>加载中...</text>
			</view>
			
			<view v-if="currentIndex >= paragraphs.length && visibleParagraphs.length > 0" class="end">
				<text>已到文章结尾</text>
			</view>
			
			<!-- 底部间距 -->
			<view class="footer-spacing"></view>
		</scroll-view>
		
		<!-- 固定底部工具栏 -->
		<view class="toolbar">
			<view class="toolbar-item" @click="toggleBookmark">
				<text class="iconfont icon-bookmark"></text>
				<text class="label">{{ isBookmarked ? '书签' : '添加书签' }}</text>
			</view>
			
			<view class="toolbar-item" @click="viewBookmarks" v-if="isBookmarked">
				<text class="iconfont icon-list"></text>
				<text class="label">查看书签</text>
			</view>
			
			<view class="toolbar-item" @click="saveProgress">
				<text class="iconfont icon-save"></text>
				<text class="label">保存进度</text>
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

// 懒加载相关
const paragraphs = ref<string[]>([]);
const visibleParagraphs = ref<string[]>([]);
const currentIndex = ref(0);
const pageSize = 10; // 每次加载的段落数（减少到10）
const isLoading = ref(false);
const maxVisibleParagraphs = 200; // 最大可见段落数，防止内存溢出

const loadArticle = () => {
	const articles = uni.getStorageSync("articles") || [];
	const article = articles.find((a: any) => a.id === articleId.value);
	if (article) {
		title.value = article.title;
		content.value = article.content;

		// 将内容按段落分割
		paragraphs.value = content.value.split("\n").filter((p) => p.trim().length > 0);

		// 初始加载适量段落
		const initialLoad = Math.min(15, paragraphs.value.length); // 初始加载15个段落
		visibleParagraphs.value = paragraphs.value.slice(0, initialLoad);
		currentIndex.value = initialLoad;
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

				// 确保书签位置的段落已加载
				if (bookmark.paragraphIndex && bookmark.paragraphIndex > currentIndex.value) {
					currentIndex.value = Math.min(bookmark.paragraphIndex + pageSize, paragraphs.value.length);
					visibleParagraphs.value = paragraphs.value.slice(0, currentIndex.value);
				}

				scrollTop.value = bookmark.scrollTop || 0;
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
			console.log("查看书签操作取消", err);
		},
	});
};

const manageBookmarks = () => {
	if (bookmarks.value.length === 0) {
		uni.showToast({
			title: "暂无书签",
			icon: "none",
		});
		return;
	}

	const bookmarkNames = bookmarks.value.map((b) => b.name);
	uni.showActionSheet({
		itemList: bookmarkNames,
		success: (res) => {
			if (res.tapIndex >= 0 && res.tapIndex < bookmarks.value.length) {
				const bookmark = bookmarks.value[res.tapIndex];
				setTimeout(() => {
					uni.showActionSheet({
						itemList: ["重命名", "删除"],
						success: (actionRes) => {
							if (actionRes.tapIndex === 0) {
								renameBookmark(bookmark);
							} else if (actionRes.tapIndex === 1) {
								deleteBookmark(bookmark.id);
							}
						},
						fail: (err) => {
							console.log("管理操作取消", err);
						},
					});
				}, 300);
			}
		},
		fail: (err) => {
			console.log("选择书签取消", err);
		},
	});
};

const renameBookmark = (bookmark: any) => {
	uni.showModal({
		title: "重命名书签",
		content: bookmark.name,
		editable: true,
		success: (res) => {
			if (res.confirm && res.content && res.content.trim()) {
				const allBookmarks = uni.getStorageSync("bookmarks") || [];
				const index = allBookmarks.findIndex((b: any) => b.id === bookmark.id);
				if (index > -1) {
					allBookmarks[index].name = res.content.trim();
					uni.setStorageSync("bookmarks", allBookmarks);
					loadBookmark(); // 重新加载书签数据
					uni.showToast({
						title: "书签已重命名",
						icon: "success",
					});
				} else {
					uni.showToast({
						title: "书签不存在",
						icon: "none",
					});
				}
			}
		},
		fail: (err) => {
			console.log("重命名操作取消", err);
		},
	});
};

const deleteBookmark = (bookmarkId: string) => {
	uni.showModal({
		title: "确认删除",
		content: "确定要删除这个书签吗？此操作不可撤销。",
		success: (res) => {
			if (res.confirm) {
				const allBookmarks = uni.getStorageSync("bookmarks") || [];
				const filteredBookmarks = allBookmarks.filter((b: any) => b.id !== bookmarkId);

				if (filteredBookmarks.length < allBookmarks.length) {
					uni.setStorageSync("bookmarks", filteredBookmarks);
					loadBookmark(); // 重新加载书签数据
					uni.showToast({
						title: "书签已删除",
						icon: "success",
					});
				} else {
					uni.showToast({
						title: "删除失败，书签不存在",
						icon: "none",
					});
				}
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
	});
};

const onScroll = (e: any) => {
	scrollTop.value = e.detail.scrollTop;

	// 检查是否需要加载更多内容
	if (!isLoading.value && currentIndex.value < paragraphs.value.length) {
		const detail = e.detail || {};
		const currentScrollTop = detail.scrollTop || 0;
		const scrollHeight = detail.scrollHeight || 0;
		const clientHeight = detail.clientHeight || 0;

		// 简化条件：只要滚动位置超过容器高度的80%，就加载更多
		const scrollRatio = currentScrollTop / (scrollHeight - clientHeight || 1);
		const shouldLoadMore = scrollRatio > 0.8 || visibleParagraphs.value.length < 50;

		if (shouldLoadMore) {
			loadMoreParagraphs();
		}
	}
};

onLoad((query: any) => {
	articleId.value = query.id || "";
	loadArticle();
	loadBookmark();
	loadProgress();
});

onUnload(() => {
	saveProgress();
});
</script>

<style lang="less" scoped>
.article-container {
	display: flex;
	flex-direction: column;
	height: 100vh;
	background-color: #f5f5f5;
}

.header {
	padding: 30rpx 30rpx 20rpx;
	background-color: #fff;
	border-bottom: 1rpx solid #eee;
}

.title {
	font-size: 36rpx;
	font-weight: bold;
	color: #333;
	line-height: 1.4;
}

.content {
	flex: 1;
	padding: 30rpx;
	background-color: #fff;
}

.paragraph {
	margin-bottom: 30rpx;
	line-height: 1.7;
	text-align: justify;
	font-size: 32rpx;
	color: #333;
}

.loading, .end {
	text-align: center;
	padding: 30rpx;
	color: #999;
	font-size: 28rpx;
}

.footer-spacing {
	height: 120rpx; /* 为底部工具栏留出空间 */
}

.toolbar {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	display: flex;
	justify-content: space-around;
	align-items: center;
	padding: 15rpx 0;
	background-color: #fff;
	border-top: 1rpx solid #eee;
	z-index: 999;
}

.toolbar-item {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	flex: 1;
	padding: 10rpx 0;
}

.iconfont {
	font-family: "iconfont" !important;
	font-size: 40rpx;
	font-style: normal;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	color: #666;
}

.icon-bookmark:before {
	content: "\e601";
}

.icon-list:before {
	content: "\e602";
}

.icon-save:before {
	content: "\e603";
}

.label {
	font-size: 24rpx;
	color: #666;
	margin-top: 5rpx;
}

/* 响应式设计 */
@media (min-width: 768px) {
	.content {
		max-width: 800px;
		margin: 0 auto;
	}
	
	.title {
		font-size: 40rpx;
	}
	
	.paragraph {
		font-size: 34rpx;
	}
}
</style>
