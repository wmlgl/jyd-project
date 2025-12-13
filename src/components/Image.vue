<script setup lang="ts">
defineProps({
	src: {
		type: String,
		default: "",
	},
});
</script>

<template>
	<image v-bind="$attrs" :src="src" />
</template>
