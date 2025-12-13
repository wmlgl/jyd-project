<template>
	<scroll-view 
		class="infinite-scroll-container"
		:scroll-y="true"
		@scroll="onScroll"
		:refresher-enabled="enableRefresh"
		:refresher-triggered="refreshing"
		@refresherrefresh="onRefresh"
		:scroll-top="scrollTopValue"
		:lower-threshold="threshold"
		@scrolltolower="onScrollToLower"
	>
		<view class="scroll-content">
			<!-- 下拉刷新区域 -->
			<view v-if="enableRefresh" class="refresh-area">
				<slot name="refresh" :refreshing="refreshing">
					<view v-if="refreshing" class="loading-indicator">
						<text>刷新中...</text>
					</view>
				</slot>
			</view>
			
			<!-- 内容区域 -->
			<slot name="content" :items="displayItems" :visible-start="visibleStart" :visible-end="visibleEnd">
				<view
					v-for="(item, index) in displayItems"
					:key="getUniqueKey(item, visibleStart + index)"
					class="scroll-item"
					:data-index="visibleStart + index"
				>
					<slot 
						name="item" 
						:item="item" 
						:index="visibleStart + index"
						:is-visible="true"
					/>
				</view>
			</slot>
			
			<!-- 底部加载更多区域 -->
			<view v-if="loadingMore" class="loading-more-area">
				<slot name="loading-more">
					<view class="loading-indicator">
						<text>加载中...</text>
					</view>
				</slot>
			</view>
			
			<!-- 没有更多数据区域 -->
			<view v-else-if="noMoreData" class="no-more-data-area">
				<slot name="no-more">
					<text>没有更多数据了</text>
				</slot>
			</view>
		</view>
	</scroll-view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';

// 定义 props
interface Props {
	// 数据列表
	list: any[];
	// 每页数量
	pageSize?: number;
	// 是否启用下拉刷新
	enableRefresh?: boolean;
	// 是否启用上拉加载更多
	enableLoadMore?: boolean;
	// 滚动到底部的阈值
	threshold?: number;
	// 预估的每项高度（用于虚拟滚动计算）
	estimatedItemHeight?: number;
	// 缓冲区数量
	buffer?: number;
	// 是否使用虚拟滚动
	useVirtualScroll?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
	pageSize: 20,
	enableRefresh: false,
	enableLoadMore: true,
	threshold: 50,
	estimatedItemHeight: 100,
	buffer: 5,
	useVirtualScroll: false,
});

// 定义 emits
const emit = defineEmits<{
	(e: 'refresh'): void;
	(e: 'loadMore'): void;
	(e: 'scroll', event: any): void;
}>();

// 状态管理
const refreshing = ref(false);
const loadingMore = ref(false);
const noMoreData = ref(false);
const scrollTop = ref(0);
const scrollTopValue = ref(0);
const currentPage = ref(1);

// 虚拟滚动相关状态
const visibleStart = ref(0);
const visibleEnd = ref(Math.min(props.pageSize, props.list.length));

// 计算显示的项目
const displayItems = computed(() => {
	if (props.useVirtualScroll) {
		// 虚拟滚动模式
		return props.list.slice(visibleStart.value, visibleEnd.value + 1);
	} else {
		// 普通模式，显示所有已加载的数据
		const endIndex = currentPage.value * props.pageSize;
		return props.list.slice(0, Math.min(endIndex, props.list.length));
	}
});

// 获取唯一键值
const getUniqueKey = (item: any, index: number) => {
	if (typeof item === 'object' && item.id) {
		return item.id;
	}
	return index;
};

// 滚动事件处理
const onScroll = (event: any) => {
	scrollTop.value = event.detail.scrollTop;
	emit('scroll', event);
	
	// 虚拟滚动计算可见区域
	if (props.useVirtualScroll) {
		calculateVisibleRange(event.detail.scrollTop, event.detail.scrollHeight);
	}
};

// 计算可见区域范围
const calculateVisibleRange = (scrollTop: number, scrollHeight: number) => {
	if (!props.useVirtualScroll) return;
	
	const containerHeight = scrollHeight; // 简化处理
	const startIndex = Math.max(0, Math.floor(scrollTop / props.estimatedItemHeight) - props.buffer);
	const endIndex = Math.min(
		props.list.length - 1,
		startIndex + Math.ceil(containerHeight / props.estimatedItemHeight) + props.buffer
	);
	
	visibleStart.value = startIndex;
	visibleEnd.value = endIndex;
};

// 下拉刷新处理
const onRefresh = () => {
	if (!props.enableRefresh) return;
	
	refreshing.value = true;
	currentPage.value = 1;
	noMoreData.value = false;
	emit('refresh');
};

// 上拉加载更多处理
const onScrollToLower = () => {
	if (!props.enableLoadMore || loadingMore.value || noMoreData.value) return;
	
	loadMore();
};

// 加载更多数据
const loadMore = () => {
	loadingMore.value = true;
	emit('loadMore');
};

// 刷新完成
const finishRefresh = () => {
	refreshing.value = false;
};

// 加载更多完成
const finishLoadMore = (hasMore: boolean = true) => {
	loadingMore.value = false;
	noMoreData.value = !hasMore;
	
	if (hasMore) {
		currentPage.value++;
	}
	
	// 修复：在数据更新后强制重新计算滚动区域
	nextTick(() => {
		// 修改为设置一个很小的值而不是undefined
		scrollTopValue.value = 1;
		setTimeout(() => {
			scrollTopValue.value = undefined as any;
		}, 50);
	});
};

// 重置组件状态
const reset = () => {
	console.log("reset scroll")
	currentPage.value = 1;
	refreshing.value = false;
	loadingMore.value = false;
	noMoreData.value = false;
	// 修改为设置一个很小的值而不是直接0
	scrollTopValue.value = 1;
	setTimeout(() => {
		scrollTopValue.value = 0;
	}, 50);
	visibleStart.value = 0;
	visibleEnd.value = Math.min(props.pageSize, props.list.length);
};

// 暴露方法给父组件
defineExpose({
	finishRefresh,
	finishLoadMore,
	reset,
	scrollToTop: () => {
		scrollTopValue.value = 0;
	},
});

// 监听列表变化
watch(() => props.list, (newList) => {
	if (newList.length === 0) {
		reset();
	}
	
	// 修复：当列表数据发生变化时，使用新的方式重置 scrollTopValue
	nextTick(() => {
		scrollTopValue.value = 1;
		setTimeout(() => {
			scrollTopValue.value = undefined as any;
		}, 50);
	});
}, { deep: true });

// 初始化
onMounted(() => {
	visibleEnd.value = Math.min(props.pageSize, props.list.length);
});
</script>

<style scoped>
.infinite-scroll-container {
	width: 100%;
	height: 100%;
}

.scroll-content {
	width: 100%;
}

.refresh-area,
.loading-more-area,
.no-more-data-area {
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 20rpx;
}

.loading-indicator {
	color: #999;
	font-size: 28rpx;
}

.scroll-item {
	width: 100%;
}
</style>