<template>
	<view class="container">
		<view class="header">
			<text class="title">文章列表</text>
			<button @click="importArticle" class="import-btn">导入文章</button>
		</view>

		<view class="article-list">
			<view v-for="article in articles" :key="article.id" class="article-item">
				<view @click="navigateToDetail(article)" class="article-content">
					<text class="article-title">{{ article.title }}</text>
					<view class="indicators">
						<text v-if="isBookmarked(article.id)" class="bookmark">📖</text>
						<text v-if="hasProgress(article.id)" class="progress">📍</text>
					</view>
				</view>
				<button @click.stop="showDeleteConfirm(article.id)" class="delete-btn">删除</button>
			</view>
		</view>

		<uni-popup ref="deletePopup" type="dialog">
			<uni-popup-dialog mode="base" title="确认删除" content="确定要删除这篇文章吗？" @confirm="confirmDelete"
				@cancel="cancelDelete"></uni-popup-dialog>
		</uni-popup>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import type UniPopup from '@dcloudio/uni-ui/lib/uni-popup/uni-popup.vue';

interface Article {
	id: string;
	title: string;
	content: string;
}

const articles = ref<Article[]>([]);

// 组件挂载时加载文章
onMounted(() => {
	loadArticles();
});

const loadArticles = () => {
	const savedArticles = uni.getStorageSync("articles");
	if (savedArticles && savedArticles.length > 0) {
		articles.value = savedArticles;
	} else {
		// 只有在没有保存的文章时才显示默认文章
		articles.value = [
			{ id: "1", title: "欢迎使用背诵应用", content: "请点击右上角的导入按钮来添加您的文章。" },
		];
	}
};

const saveArticles = () => {
	uni.setStorageSync("articles", articles.value);
};

const navigateToDetail = (article: Article) => {
	uni.navigateTo({
		url: `/pages/article-detail/article-detail?id=${article.id}`,
	});
};

const importArticle = () => {
	uni.chooseFile({
		count: 1,
		type: "all",
		extension: [".txt", ".md"],
		success: (res) => {
			const filePath = res.tempFilePaths[0];
			// #ifdef H5
			// H5平台使用FileReader
			if (typeof FileReader !== 'undefined') {
				const file = res.tempFiles[0] as File;
				if (file) {
					readFileWithEncoding(file);
				}
			}
			// #endif
			// #ifndef H5
			// 小程序平台使用getFileSystemManager
			const fs = uni.getFileSystemManager();
			fs.readFile({
				filePath,
				encoding: "utf8",
				success: (readRes) => {
					const content = readRes.data as string;
					processFileContent(content);
				},
				fail: () => {
					uni.showToast({
						title: "读取文件失败",
						icon: "error",
					});
				},
			});
			// #endif
		},
		fail: () => {
			uni.showToast({
				title: "选择文件失败",
				icon: "error",
			});
		},
	});
};

const readFileWithEncoding = (file: File) => {
	// 首先尝试UTF-8
	const utf8Reader = new FileReader();
	utf8Reader.onload = (e) => {
		const content = e.target?.result as string;
		if (isValidChineseText(content)) {
			processFileContent(content);
		} else {
			// UTF-8失败，尝试GBK解码
			tryGBKDecoding(file);
		}
	};
	utf8Reader.readAsText(file, 'UTF-8');
};

const tryGBKDecoding = (file: File) => {
	if (typeof TextDecoder !== 'undefined') {
		// 使用TextDecoder进行GBK解码
		const arrayBufferReader = new FileReader();
		arrayBufferReader.onload = (e) => {
			const arrayBuffer = e.target?.result as ArrayBuffer;
			try {
				const decoder = new TextDecoder('gbk');
				const content = decoder.decode(arrayBuffer);
				if (isValidChineseText(content)) {
					processFileContent(content);
				} else {
					// 尝试GB2312
					const decoder2312 = new TextDecoder('gb2312');
					const content2312 = decoder2312.decode(arrayBuffer);
					if (isValidChineseText(content2312)) {
						processFileContent(content2312);
					} else {
						showEncodingError();
					}
				}
			} catch (error) {
				showEncodingError();
			}
		};
		arrayBufferReader.readAsArrayBuffer(file);
	} else {
		// 不支持TextDecoder的浏览器，提示用户转换文件编码
		uni.showToast({
			title: "请将文件转换为UTF-8编码",
			icon: "none",
		});
	}
};

const showEncodingError = () => {
	uni.showToast({
		title: "文件编码不支持，请转换为UTF-8",
		icon: "none",
	});
};

const isValidChineseText = (text: string): boolean => {
	// 检测是否包含有效的中文字符
	const chineseChars = text.match(/[\u4e00-\u9fff]/g);
	const totalChars = text.replace(/\s/g, '').length;

	// 如果中文字符占比超过15%，认为是有效的中文文本
	return chineseChars && (chineseChars.length / totalChars > 0.15);
};

const processFileContent = (content: string) => {
	const lines = content.split("\n");
	const title = lines[0].trim();
	const body = lines.slice(1).join("\n").trim();

	const newArticle: Article = {
		id: Date.now().toString(),
		title,
		content: body,
	};

	articles.value.push(newArticle);
	saveArticles();

	uni.showToast({
		title: "导入成功",
		icon: "success",
	});
};

const isBookmarked = (articleId: string) => {
	const bookmarks = uni.getStorageSync("bookmarks") || [];
	return bookmarks.some((b: any) => b.articleId === articleId);
};

const hasProgress = (articleId: string) => {
	const progress = uni.getStorageSync("readingProgress") || {};
	return progress[articleId] > 0;
};

const deletePopup = ref<InstanceType<typeof UniPopup> | null>(null);
const deletingArticleId = ref("");

const showDeleteConfirm = (id: string) => {
	deletingArticleId.value = id;
	deletePopup.value?.open(); // Add optional chaining
};

const confirmDelete = () => {
	if (deletingArticleId.value) {
		articles.value = articles.value.filter(article => article.id !== deletingArticleId.value);
		saveArticles();
		uni.showToast({
			title: "删除成功",
			icon: "success"
		});
	}
	deletingArticleId.value = "";
};

const cancelDelete = () => {
	deletingArticleId.value = "";
};
</script>
<style lang="less" scoped>
.container {
	padding: 20rpx;
}

.header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 30rpx;

	.title {
		font-size: 36rpx;
		font-weight: bold;
		color: #333;
	}

	.import-btn {
		background-color: #007aff;
		color: white;
		padding: 0 20rpx;
		height: 60rpx;
		line-height: 60rpx;
		border-radius: 8rpx;
		font-size: 28rpx;
	}
}

.article-list {
	border-radius: 12rpx;
	overflow: hidden;
	box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
}

.article-item {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 24rpx;
	background-color: white;
	border-bottom: 1rpx solid #f5f5f5;

	&:last-child {
		border-bottom: none;
	}
}

.article-content {
	flex: 1;
	display: flex;
	justify-content: space-between;
	align-items: center;
}

.article-title {
	font-size: 30rpx;
	color: #333;
}

.indicators {
	display: flex;
	gap: 10rpx;
	margin-left: 20rpx;
}

.delete-btn {
	background-color: #ff3b30;
	color: white;
	padding: 0 20rpx;
	height: 56rpx;
	line-height: 56rpx;
	border-radius: 8rpx;
	font-size: 26rpx;
	margin-left: 20rpx;
}

.bookmark {
	color: #ff6b35;
}

.progress {
	color: #4caf50;
}
</style>