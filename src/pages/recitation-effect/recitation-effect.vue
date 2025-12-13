<template>
	<view>
		<text>背诵效果</text>
		<text>总次数: {{ stats.total }}</text>
		<text>正确次数: {{ stats.correct }}</text>
		<text>正确率: {{ stats.accuracy.toFixed(2) }}%</text>
		<text>平均时间: {{ stats.avgTime.toFixed(2) }}ms</text>
	</view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

interface Record {
	planId: string;
	correct: boolean;
	time: number;
	date: string;
}

const records = ref<Record[]>([]);
const stats = ref({ total: 0, correct: 0, accuracy: 0, avgTime: 0 });

const loadRecords = () => {
	records.value = uni.getStorageSync("recitationRecords") || [];
	const total = records.value.length;
	const correct = records.value.filter(r => r.correct).length;
	const accuracy = total > 0 ? (correct / total) * 100 : 0;
	const avgTime = total > 0 ? records.value.reduce((sum, r) => sum + r.time, 0) / total : 0;
	stats.value = { total, correct, accuracy, avgTime };
};

onMounted(() => {
	loadRecords();
});
</script>