<template>
	<view class="container">
		<!-- 页面头部 -->
		<view class="header">
			<view class="nav-bar">
				<button @click="goBack" class="back-btn">←</button>
				<text class="page-title">{{ isEdit ? "编辑计划" : "创建计划" }}</text>
				<view class="spacer"></view>
			</view>
		</view>

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
					<view v-for="(type, index) in itemTypes" :key="type" :class="['type-card', { active: selectedTypeIndex === index }]" @click="selectType(index)">
						<view class="type-icon">
							<text>{{ type === "article" ? "📄" : "📝" }}</text>
						</view>
						<text class="type-name">{{ type === "article" ? "整篇文章" : "单个段落" }}</text>
						<text class="type-desc">{{ type === "article" ? "背诵完整文章" : "选择具体段落" }}</text>
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
							<view v-for="(article, index) in articles" :key="article.id" :class="['article-card', { selected: selectedArticleIndex === index }]" @click="selectArticle(index)">
								<text class="article-title">{{ article.title }}</text>
								<text class="article-preview">{{ getArticlePreview(article.content) }}</text>
								<view class="article-stats">
									<text class="stat">{{ getParagraphCount(article.content) }}段</text>
								</view>
							</view>
						</view>
					</view>

					<!-- 段落选择（仅当选择段落类型时显示） -->
					<view v-if="itemTypes[selectedTypeIndex] === 'paragraph' && selectedArticleIndex >= 0" class="selection-step">
						<view class="step-header">
							<text class="step-number">2</text>
							<text class="step-title">选择段落 (已选{{ selectedParagraphIndices.length }}个)</text>
						</view>
						<InfiniteScrollList :items="currentParagraphs" :selected-indices="selectedParagraphIndices" :item-height="100" :buffer="5" @item-click="toggleParagraphSelection" @refresh="handleRefresh" />
					</view>

					<!-- 添加按钮 -->
					<view class="action-area">
						<button @click="addItem" class="add-item-btn" :disabled="!canAddItem">
							<text class="btn-icon">+</text>
							<text class="btn-text">添加{{ itemTypes[selectedTypeIndex] === "article" ? "文章" : "段落" }}</text>
						</button>
					</view>
				</view>
			</view>
		</view>

		<!-- 项目列表 -->
		<view class="section">
			<view class="items-section">
				<view class="section-header">
					<text class="section-title">背诵项目 ({{ items.length }})</text>
					<text v-if="items.length > 0" class="clear-all" @click="clearAllItems">清空</text>
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
								<text class="badge-icon">{{ item.type === "article" ? "📄" : "📝" }}</text>
								<text class="badge-text">{{ item.type === "article" ? "文章" : "段落" }}</text>
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
					{{ isEdit ? "保存修改" : "创建计划" }}
				</button>
			</view>
		</view>
	</view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { InfiniteScrollList } from "@/components";

// 定义 props
interface Props {
	items: string[];
	selectedIndices: number[];
	itemHeight?: number;
	buffer?: number;
}

const props = withDefaults(defineProps<Props>(), {
	itemHeight: 100,
	buffer: 5,
});

// 定义 emits
const emit = defineEmits<{
	(e: "itemClick", index: number): void;
	(e: "refresh"): void;
}>();

// 状态管理
const containerHeight = ref(600); // 默认容器高度
const scrollTop = ref(0);
const refreshing = ref(false);
const loading = ref(false);

// 触摸事件处理相关
const startY = ref(0);
const currentY = ref(0);
const isScrolling = ref(false);

// 计算可见项范围
const visibleStartIndex = computed(() => {
	const startIndex = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.buffer);
	return startIndex;
});

const visibleEndIndex = computed(() => {
	const endIndex = Math.min(props.items.length - 1, Math.ceil((scrollTop.value + containerHeight.value) / props.itemHeight) + props.buffer);
	return endIndex;
});

const visibleItems = computed(() => {
	return props.items.slice(visibleStartIndex.value, visibleEndIndex.value + 1);
});

// 方法定义
const onScroll = (event: any) => {
	scrollTop.value = event.detail.scrollTop;
};

const onRefresh = () => {
	refreshing.value = true;
	emit("refresh");
	// 模拟刷新完成
	setTimeout(() => {
		refreshing.value = false;
	}, 1000);
};

const onItemClick = (index: number) => {
	emit("itemClick", index);
};

const isSelected = (index: number) => {
	return props.selectedIndices.includes(index);
};

const getItemClass = (index: number) => {
	return ["paragraph-card", { selected: isSelected(index) }];
};

const handleRefresh = () => {
	// 处理下拉刷新逻辑（如果需要）
	console.log("Refreshing paragraph list");
};

// 触摸事件处理函数，防止滚动穿透
const handleTouchStart = (e: TouchEvent) => {
	startY.value = e.touches[0].clientY;
	isScrolling.value = false;
};

const handleTouchMove = (e: TouchEvent) => {
	currentY.value = e.touches[0].clientY;
	const deltaY = startY.value - currentY.value;
	
	// 阻止默认行为以防止页面滚动
	if (!isScrolling.value) {
		e.preventDefault();
		e.stopPropagation();
		isScrolling.value = true;
	}
};

const handleTouchEnd = () => {
	isScrolling.value = false;
};

// ScrollView 的触摸事件处理
const handleScrollViewTouchStart = (e: TouchEvent) => {
	// 不需要特殊处理
};

const handleScrollViewTouchMove = (e: TouchEvent) => {
	// 阻止事件冒泡
	e.stopPropagation();
};

const handleScrollViewTouchEnd = () => {
	// 不需要特殊处理
};

// 初始化容器高度
onMounted(() => {
	// 这里可以根据实际需求调整容器高度
	containerHeight.value = 600;
});

// 监听 items 变化
watch(
	() => props.items,
	() => {
		// 当数据变化时重置滚动位置或其他状态
	},
	{ deep: true }
);
</script>

<style scoped>
.infinite-scroll-container {
	max-height: 600rpx;

	overflow: hidden;
	border: 1rpx solid #e9ecef;
	border-radius: 12rpx;
	margin-right: 40rpx;
}

.scroll-content {

	max-height: 600rpx;
	height: 100%;
}

.scroll-inner {
	min-height: 100%;
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

.loading-indicator {
	text-align: center;
	padding: 20rpx;
	color: #999;
}
</style>
