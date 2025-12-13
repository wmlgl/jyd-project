<template>
	<view class="container">

		<!-- 计划名称输入 -->
		<view class="section">
			<view class="input-card">
				<text class="input-label">计划名称</text>
				<input v-model="planName" placeholder="给你的背诵计划起个名字" class="plan-input" maxlength="50" />
				<text class="char-count">{{ planName.length }}/50</text>
			</view>
		</view>

		<!-- 添加项目区域 -->
		<view class="section">
			<view class="add-section">
				<text class="section-title">添加背诵内容</text>

				<!-- 类型选择卡片 -->
				<view class="type-selection">
					<view v-for="(type, index) in itemTypes" :key="type"
						:class="['type-card', { active: selectedTypeIndex === index }]" @click="selectType(index)">
						<view class="type-icon">
							<text>{{ type === 'article' ? '📄' : '📝' }}</text>
						</view>
						<text class="type-name">{{ type === 'article' ? '整篇文章' : '单个段落' }}</text>
						<text class="type-desc">{{ type === 'article' ? '背诵完整文章' : '选择具体段落' }}</text>
					</view>
				</view>

				<!-- 内容选择区域 -->
				<view v-if="selectedTypeIndex >= 0" class="content-selection">
					<!-- 文章选择 -->
					<view class="selection-step">
						<view class="step-header">
							<text class="step-number">1</text>
							<text class="step-title">选择文章</text>
						</view>
						<view v-if="articles.length === 0" class="empty-state">
							<text class="empty-icon">📚</text>
							<text class="empty-text">暂无文章，请先导入文章</text>
							<button @click="goToArticleList" class="import-btn">去导入文章</button>
						</view>
						<view v-else class="article-grid">
							<view v-for="(article, index) in articles" :key="article.id"
								:class="['article-card', { selected: selectedArticleIndex === index }]"
								@click="selectArticle(index)">
								<text class="article-title">{{ article.title }}</text>
								<text class="article-preview">{{ getArticlePreview(article.content) }}</text>
								<view class="article-stats">
									<text class="stat">{{ getParagraphCount(article.content) }}段</text>
								</view>
							</view>
						</view>
					</view>

					<!-- 段落选择区域（仅当选择段落类型时显示） -->
					<view v-if="itemTypes[selectedTypeIndex] === 'paragraph' && selectedArticleIndex >= 0"
						class="selection-step">
						<view class="step-header">
							<text class="step-number">2</text>
							<text class="step-title">选择段落 (已选{{ selectedParagraphIndices.length }}个)</text>
						</view>

						<scroll-view scroll-y class="paragraph-scroll-container" @scrolltolower="loadMoreParagraphs"
							@touchstart="handleTouchStart" @touchmove="handleTouchMove" @touchend="handleTouchEnd">
							<view v-for="(item, index) in currentParagraphs" :key="index"
								:class="['paragraph-card', { selected: isSelected(index) }]"
								@click="toggleParagraphSelection(index)">
								<view class="selection-indicator">
									<text v-if="isSelected(index)" class="checkmark">✓</text>
									<text v-else class="checkbox">○</text>
								</view>
								<view class="paragraph-number">{{ index + 1 }}</view>
								<text class="paragraph-content">{{ item }}</text>
							</view>
							<!-- 添加加载状态提示 -->
							<view v-if="isLoading" class="loading-more">加载中...</view>
							<view v-if="!hasMore && totalParagraphs?.length > 0" class="no-more">没有更多了</view>
						</scroll-view>
					</view>

					<!-- 添加按钮 -->
					<view class="action-area">
						<button @click="addItem" class="add-item-btn" :disabled="!canAddItem">
							<text class="btn-icon">+</text>
							<text class="btn-text">添加{{ itemTypes[selectedTypeIndex] === 'article' ? '文章' : '段落' }}</text>
						</button>
					</view>
				</view>

				<!-- 项目列表 -->
				<view class="section">
					<view class="items-section">
						<view class="section-header">
							<text class="section-title">背诵项目 ({{ items?.length || 0 }})</text>
							<text v-if="items?.length > 0" class="clear-all" @click="clearAllItems">清空</text>
						</view>

						<view v-if="items.length === 0" class="empty-items">
							<text class="empty-icon">🎯</text>
							<text class="empty-text">还没有添加任何内容</text>
							<text class="empty-hint">选择上面的类型开始添加吧</text>
						</view>

						<view v-else class="items-list">
							<view v-for="(item, index) in items" :key="index" class="item-card">
								<view class="item-header">
									<view class="item-type-badge">
										<text class="badge-icon">{{ item.type === 'article' ? '📄' : '📝' }}</text>
										<text class="badge-text">{{ item.type === 'article' ? '文章' : '段落' }}</text>
									</view>
									<button @click="removeItem(index)" class="item-remove">×</button>
								</view>
								<text class="item-content">{{ item.content }}</text>
								<view v-if="item.type === 'paragraph'" class="item-meta">
									<text class="meta-text">来自文章：{{ getArticleTitle(item.articleId) }}</text>
								</view>
							</view>
						</view>
					</view>
				</view>

				<!-- 底部操作区 -->
				<view class="footer">
					<view class="footer-content">
						<button @click="goBack" class="cancel-btn">取消</button>
						<button @click="savePlan" class="save-btn" :disabled="!canSave">
							{{ isEdit ? '保存修改' : '创建计划' }}
						</button>
					</view>
				</view>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { InfiniteScroll } from "@/components";

interface PlanItem {
	type: 'article' | 'paragraph';
	content: string;
	articleId?: string;
	paragraphIndices?: number[];
}

interface Plan {
	id: string;
	name: string;
	items: PlanItem[];
}

interface Article {
	id: string;
	title: string;
	content: string;
}

const planName = ref("");
const items = ref<PlanItem[]>([]);
const selectedTypeIndex = ref(-1);
const itemTypes = ['article', 'paragraph'];
const isEdit = ref(false);
const planId = ref("");

// 文章选择相关
const articles = ref<Article[]>([]);
const selectedArticleIndex = ref(-1);
const selectedParagraphIndices = ref<number[]>([]);
// 添加对无限滚动组件的引用
const infiniteScrollRef = ref<InstanceType<typeof InfiniteScroll> | null>(null);

// 分页加载相关
const pageSize = ref(10); // 每页显示段落数
const currentPage = ref(1); // 当前页码
const totalParagraphs = ref<string[]>([]); // 存储所有段落
const isLoading = ref(false); // 加载状态
const hasMore = ref(true); // 是否还有更多数据

// 修改为分页加载当前页段落
const currentParagraphs = computed(() => {
	// 直接返回所有已加载的段落，不再分页
	return totalParagraphs.value.slice(0, currentPage.value * pageSize.value);
});

// 修改 watch 监听 selectedArticleIndex
watch(selectedArticleIndex, (newVal) => {
	if (newVal >= 0) {
		const article = articles.value[newVal];
		totalParagraphs.value = article.content.split('\n').filter(p => p.trim().length > 0);
		currentPage.value = 1; // 重置为第一页
		hasMore.value = totalParagraphs.value.length > pageSize.value; // 根据总长度设置是否有更多数据
		// 重置后需要强制组件重新计算
		nextTick(() => {
			infiniteScrollRef.value?.reset();
		});
	} else {
		totalParagraphs.value = [];
	}
});

const canAddItem = computed(() => {
	const itemType = itemTypes[selectedTypeIndex.value];
	if (itemType === 'article') {
		return selectedArticleIndex.value >= 0;
	} else if (itemType === 'paragraph') {
		return selectedArticleIndex.value >= 0 && selectedParagraphIndices.value.length > 0;
	}
	return false;
});

// 添加对滚动位置的引用
const scrollPosition = ref(0);

// 加载更多段落
const loadMoreParagraphs = () => {
	if (isLoading.value || !hasMore.value) return;

	isLoading.value = true;
	const nextPage = currentPage.value + 1;
	const totalPages = Math.ceil(totalParagraphs.value.length / pageSize.value);

	if (nextPage <= totalPages) {
		currentPage.value = nextPage;
		hasMore.value = nextPage < totalPages;
	}

	isLoading.value = false;
};

// 添加新方法以适配InfiniteScroll组件
const onItemClick = (index: number) => {
	// 计算全局索引
	const globalIndex = (currentPage.value - 1) * pageSize.value + index;
	toggleParagraphSelection(globalIndex);
};

// 修改 isSelected 方法以使用全局索引
const isSelected = (globalIndex: number) => {
	return selectedParagraphIndices.value.includes(globalIndex);
};

// 修改 getItemClass 方法以使用全局索引
const getItemClass = (index: number) => {
	// 计算全局索引
	const globalIndex = (currentPage.value - 1) * pageSize.value + index;
	return ["paragraph-card", { selected: isSelected(globalIndex) }];
};

const canSave = computed(() => {
	return planName.value.trim().length > 0 && items.value.length > 0;
});

const loadArticles = () => {
	articles.value = uni.getStorageSync("articles") || [];
};

const selectType = (index: number) => {
	selectedTypeIndex.value = index;
	selectedArticleIndex.value = -1;
	selectedParagraphIndices.value = [];
};

const selectArticle = (index: number) => {
	selectedArticleIndex.value = index;
	selectedParagraphIndices.value = [];
};

const toggleParagraphSelection = (index: number) => {
	const currentIndices = selectedParagraphIndices.value;
	const indexPosition = currentIndices.indexOf(index);

	if (indexPosition > -1) {
		// 如果已选中，取消选择
		selectedParagraphIndices.value = currentIndices.filter(i => i !== index);
	} else {
		// 如果未选中，添加选择
		selectedParagraphIndices.value = [...currentIndices, index];
	}
};

const getArticlePreview = (content: string) => {
	const paragraphs = content.split('\n').filter(p => p.trim().length > 0);
	if (paragraphs.length > 0) {
		return paragraphs[0].substring(0, 60) + (paragraphs[0].length > 60 ? '...' : '');
	}
	return '';
};

const getParagraphCount = (content: string) => {
	const paragraphs = content.split('\n').filter(p => p.trim().length > 0);
	return paragraphs.length;
};

const getArticleTitle = (articleId?: string) => {
	if (!articleId) return '';
	const article = articles.value.find(a => a.id === articleId);
	return article ? article.title : '未知文章';
};

const addItem = () => {
	const itemType = itemTypes[selectedTypeIndex.value];

	if (itemType === 'article') {
		if (selectedArticleIndex.value >= 0) {
			const article = articles.value[selectedArticleIndex.value];
			items.value.push({
				type: 'article',
				content: article.title,
				articleId: article.id,
			});
			selectedArticleIndex.value = -1;
			uni.showToast({ title: "文章已添加", icon: "success" });
		}
	} else if (itemType === 'paragraph') {
		if (selectedArticleIndex.value >= 0 && selectedParagraphIndices.value.length > 0) {
			const article = articles.value[selectedArticleIndex.value];
			const paragraphs = article.content.split('\n').filter(p => p.trim().length > 0);
			const selectedParagraphs = selectedParagraphIndices.value.map(index => paragraphs[index]);

			// 为每个选中的段落创建单独的项目
			selectedParagraphIndices.value.forEach((paragraphIndex, arrayIndex) => {
				items.value.push({
					type: 'paragraph',
					content: selectedParagraphs[arrayIndex],
					articleId: article.id,
					paragraphIndices: [paragraphIndex],
				});
			});

			selectedArticleIndex.value = -1;
			selectedParagraphIndices.value = [];
			uni.showToast({ title: `已添加${selectedParagraphs.length}个段落`, icon: "success" });
		}
	}
};

const removeItem = (index: number) => {
	items.value.splice(index, 1);
};

const clearAllItems = () => {
	uni.showModal({
		title: '确认清空',
		content: '确定要清空所有项目吗？',
		success: (res) => {
			if (res.confirm) {
				items.value = [];
				uni.showToast({ title: "已清空", icon: "success" });
			}
		}
	});
};

const savePlan = () => {
	if (!planName.value.trim()) {
		uni.showToast({ title: "请输入计划名称", icon: "error" });
		return;
	}
	const plans = uni.getStorageSync("plans") || [];
	const plan: Plan = {
		id: planId.value || Date.now().toString(),
		name: planName.value.trim(),
		items: items.value,
	};
	if (isEdit.value) {
		const index = plans.findIndex((p: Plan) => p.id === planId.value);
		if (index !== -1) {
			plans[index] = plan;
		}
	} else {
		plans.push(plan);
	}
	uni.setStorageSync("plans", plans);
	uni.showToast({ title: "保存成功", icon: "success" });
	uni.navigateBack();
};

const goBack = () => {
	uni.navigateBack();
};

const goToArticleList = () => {
	uni.navigateTo({
		url: '/pages/article-reading/article-reading'
	});
};
const startY = ref(0);
const currentY = ref(0);
const isScrolling = ref(false);

// 添加触摸事件处理函数，防止滚动穿透
const handleTouchStart = (e: TouchEvent) => {
	startY.value = e.touches[0].clientY;
	isScrolling.value = false;
};

const handleTouchMove = (e: TouchEvent) => {
	currentY.value = e.touches[0].clientY;
	const deltaY = startY.value - currentY.value;

	// 只有在垂直滚动时才阻止默认行为
	if (!isScrolling.value && Math.abs(deltaY) > 10) {
		// e.preventDefault();
		e.stopPropagation();
		isScrolling.value = true;
	}
};


const handleTouchEnd = () => {
	isScrolling.value = false;
};

onLoad((query: any) => {
	loadArticles();
	if (query.id) {
		isEdit.value = true;
		planId.value = query.id;
		const plans = uni.getStorageSync("plans") || [];
		const plan = plans.find((p: Plan) => p.id === query.id);
		if (plan) {
			planName.value = plan.name;
			items.value = plan.items;
		}
	}
});
</script>

<style>
.container {
	min-height: 100vh;
	background-color: #f8f9fa;
	padding-bottom: 120rpx;
}

.header {
	background-color: #fff;
	border-bottom: 1rpx solid #e9ecef;
}

.nav-bar {
	display: flex;
	align-items: center;
	padding: 20rpx 30rpx;
	height: 100rpx;
}

.back-btn {
	width: 80rpx;
	height: 80rpx;
	border-radius: 50%;
	background-color: #f8f9fa;
	border: none;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 36rpx;
	color: #666;
	margin-right: 20rpx;
}

.page-title {
	font-size: 36rpx;
	font-weight: bold;
	color: #333;
	flex: 1;
}

.spacer {
	width: 80rpx;
}

.section {
	padding: 0 30rpx;
	margin-bottom: 20rpx;
}

.input-card {
	background-color: #fff;
	border-radius: 16rpx;
	padding: 30rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

.input-label {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	color: #333;
	margin-bottom: 16rpx;
}

.plan-input {
	border: 2rpx solid #e9ecef;
	border-radius: 12rpx;
	padding: 24rpx 30rpx;
	font-size: 32rpx;
	width: 100%;
	box-sizing: border-box;
	min-height: 80rpx;
	transition: border-color 0.3s;
}

.plan-input:focus {
	border-color: #007aff;
}

.char-count {
	display: block;
	text-align: right;
	font-size: 24rpx;
	color: #999;
	margin-top: 8rpx;
}

.add-section {
	background-color: #fff;
	border-radius: 16rpx;
	padding: 30rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

.section-title {
	font-size: 36rpx;
	font-weight: bold;
	color: #333;
	margin-bottom: 30rpx;
	display: block;
}

.type-selection {
	display: flex;
	gap: 20rpx;
	margin-bottom: 40rpx;
}

.type-card {
	flex: 1;
	background-color: #f8f9fa;
	border: 2rpx solid #e9ecef;
	border-radius: 16rpx;
	padding: 30rpx 20rpx;
	text-align: center;
	transition: all 0.3s;
	cursor: pointer;
}

.type-card.active {
	background-color: #007aff;
	border-color: #007aff;
}

.type-card.active .type-name,
.type-card.active .type-desc {
	color: #fff;
}

.type-icon {
	font-size: 48rpx;
	margin-bottom: 12rpx;
	display: block;
}

.type-name {
	font-size: 30rpx;
	font-weight: 600;
	color: #333;
	margin-bottom: 8rpx;
	display: block;
}

.type-desc {
	font-size: 24rpx;
	color: #666;
}

.content-selection {
	margin-top: 40rpx;
}

.selection-step {
	margin-bottom: 40rpx;
}

.step-header {
	display: flex;
	align-items: center;
	margin-bottom: 20rpx;
}

.step-number {
	width: 60rpx;
	height: 60rpx;
	border-radius: 50%;
	background-color: #007aff;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 28rpx;
	font-weight: bold;
	margin-right: 20rpx;
}

.step-title {
	font-size: 32rpx;
	font-weight: 600;
	color: #333;
}

.empty-state {
	text-align: center;
	padding: 80rpx 40rpx;
}

.empty-icon {
	font-size: 120rpx;
	display: block;
	margin-bottom: 20rpx;
}

.empty-text {
	font-size: 32rpx;
	color: #666;
	margin-bottom: 30rpx;
	display: block;
}

.import-btn {
	background-color: #28a745;
	color: #fff;
	border: none;
	border-radius: 12rpx;
	padding: 20rpx 40rpx;
	font-size: 28rpx;
}

.article-grid {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.article-card {
	background-color: #f8f9fa;
	border: 2rpx solid #e9ecef;
	border-radius: 12rpx;
	padding: 24rpx;
	transition: all 0.3s;
	cursor: pointer;
}

.article-card:hover,
.article-card.selected {
	border-color: #007aff;
	background-color: #e7f3ff;
}

.article-title {
	font-size: 32rpx;
	font-weight: 600;
	color: #333;
	margin-bottom: 12rpx;
	display: block;
}

.article-preview {
	font-size: 28rpx;
	color: #666;
	line-height: 1.5;
	margin-bottom: 16rpx;
	display: block;
}

.article-stats {
	display: flex;
	justify-content: flex-end;
}

.stat {
	font-size: 24rpx;
	color: #999;
	background-color: #fff;
	padding: 6rpx 16rpx;
	border-radius: 20rpx;
	border: 1rpx solid #e9ecef;
}

/* 修改无限滚动容器样式 */
.paragraph-scroll-container {
	max-height: 600rpx;
	margin-right: 40rpx;
	overflow-y: auto;
	/* 确保始终有滚动条 */
	touch-action: pan-y;
	/* 允许垂直滚动 */
}

.paragraph-list {
	max-height: 600rpx;
	overflow-y: auto;
	border: 1rpx solid #e9ecef;
	border-radius: 12rpx;
	margin-right: 40rpx;
}

.paragraph-card {
	padding: 24rpx 30rpx;
	border-bottom: 1rpx solid #f0f0f0;
	transition: all 0.3s;
	cursor: pointer;
	display: flex;
	align-items: flex-start;
}

.paragraph-card:last-child {
	border-bottom: none;
}

.paragraph-card:hover,
.paragraph-card.selected {
	background-color: #e7f3ff;
}

.selection-indicator {
	width: 60rpx;
	height: 60rpx;
	border-radius: 50%;
	background-color: #f0f0f0;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 20rpx;
	flex-shrink: 0;
	transition: all 0.3s;
}

.paragraph-card.selected .selection-indicator {
	background-color: #007aff;
}

/* 加载更多样式 */
.loading-more,
.no-more {
	text-align: center;
	padding: 20rpx;
	color: #666;
	font-size: 28rpx;
}

.checkbox {
	font-size: 32rpx;
	color: #999;
}

.checkmark {
	font-size: 32rpx;
	color: #fff;
	font-weight: bold;
}

.paragraph-number {
	width: 60rpx;
	height: 60rpx;
	border-radius: 50%;
	background-color: #007aff;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 28rpx;
	font-weight: bold;
	margin-right: 20rpx;
	flex-shrink: 0;
}

.paragraph-content {
	font-size: 28rpx;
	color: #333;
	line-height: 1.6;
	flex: 1;
}

.action-area {
	margin-top: 40rpx;
	text-align: center;
}

.add-item-btn {
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: #fff;
	border: none;
	border-radius: 50rpx;
	padding: 24rpx 60rpx;
	font-size: 32rpx;
	font-weight: 600;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 200rpx;
	transition: all 0.3s;
}

.add-item-btn:disabled {
	background: #ccc;
	cursor: not-allowed;
}

.btn-icon {
	font-size: 36rpx;
	margin-right: 12rpx;
}

.btn-text {
	font-size: 32rpx;
}

.items-section {
	background-color: #fff;
	border-radius: 16rpx;
	padding: 30rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.08);
}

.section-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 30rpx;
}

.clear-all {
	font-size: 28rpx;
	color: #ff3b30;
	cursor: pointer;
}

.empty-items {
	text-align: center;
	padding: 80rpx 40rpx;
}

.empty-items .empty-icon {
	font-size: 120rpx;
	display: block;
	margin-bottom: 20rpx;
}

.empty-items .empty-text {
	font-size: 32rpx;
	color: #666;
	margin-bottom: 12rpx;
	display: block;
}

.empty-hint {
	font-size: 26rpx;
	color: #999;
}

.items-list {
	display: flex;
	flex-direction: column;
	gap: 20rpx;
}

.item-card {
	background-color: #f8f9fa;
	border-radius: 12rpx;
	padding: 24rpx;
	border: 1rpx solid #e9ecef;
	transition: all 0.3s;
}

.item-header {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16rpx;
}

.item-type-badge {
	display: flex;
	align-items: center;
	background-color: #007aff;
	color: #fff;
	padding: 8rpx 16rpx;
	border-radius: 20rpx;
	font-size: 24rpx;
}

.badge-icon {
	margin-right: 8rpx;
}

.item-remove {
	width: 60rpx;
	height: 60rpx;
	border-radius: 50%;
	background-color: #ff3b30;
	color: #fff;
	border: none;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 32rpx;
	font-weight: bold;
	transition: all 0.3s;
}

.item-remove:hover {
	background-color: #d63027;
	transform: scale(1.1);
}

.item-content {
	font-size: 30rpx;
	color: #333;
	line-height: 1.5;
	margin-bottom: 12rpx;
}

.item-meta {
	display: flex;
	align-items: center;
}

.meta-text {
	font-size: 24rpx;
	color: #666;
	background-color: #f0f0f0;
	padding: 6rpx 12rpx;
	border-radius: 12rpx;
}

.footer {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	background-color: #fff;
	border-top: 1rpx solid #e9ecef;
	padding: 20rpx 30rpx;
	box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.08);
}

.footer-content {
	display: flex;
	gap: 20rpx;
}

.cancel-btn {
	flex: 1;
	background-color: #f8f9fa;
	color: #666;
	border: 2rpx solid #e9ecef;
	border-radius: 12rpx;
	padding: 24rpx;
	font-size: 32rpx;
	font-weight: 600;
	transition: all 0.3s;
}

.cancel-btn:hover {
	background-color: #e9ecef;
}

.save-btn {
	flex: 2;
	background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	color: #fff;
	border: none;
	border-radius: 12rpx;
	padding: 24rpx;
	font-size: 32rpx;
	font-weight: 600;
	transition: all 0.3s;
}

.save-btn:disabled {
	background: #ccc;
	cursor: not-allowed;
}
</style>