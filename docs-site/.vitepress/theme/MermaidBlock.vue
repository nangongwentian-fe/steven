<script setup lang="ts">
import mermaid from "mermaid";
import type { PanzoomObject } from "@panzoom/panzoom";
import { useData, useRoute } from "vitepress";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

const VIEWPORT_PADDING = 24;
const MIN_VIEWPORT_HEIGHT = 240;
const MAX_VIEWPORT_HEIGHT = 560;
const MAX_VIEWPORT_HEIGHT_RATIO = 0.72;
const SCALE_EPSILON = 0.01;

const props = defineProps<{
	code: string;
}>();

const route = useRoute();
const { isDark } = useData();

const viewport = ref<HTMLElement | null>(null);
const stage = ref<HTMLElement | null>(null);
const error = ref<string | null>(null);
const currentScale = ref(1);
const initialScale = ref(1);
const minScale = ref(1);
const maxScale = ref(1);
const viewerReady = ref(false);
const instanceId = `mermaid-${crypto.randomUUID()}`;
const renderCount = ref(0);

const canZoomIn = computed(() => viewerReady.value && currentScale.value < maxScale.value - SCALE_EPSILON);
const canZoomOut = computed(() => viewerReady.value && currentScale.value > minScale.value + SCALE_EPSILON);
const canReset = computed(() => viewerReady.value);
const source = computed(() => {
	const bytes = Uint8Array.from(atob(props.code), (char) => char.charCodeAt(0));
	return new TextDecoder().decode(bytes);
});

let createPanzoom: typeof import("@panzoom/panzoom").default | null = null;
let panzoom: PanzoomObject | null = null;
let resizeObserver: ResizeObserver | null = null;
let wheelHandler: ((event: WheelEvent) => void) | null = null;
let changeHandler: (() => void) | null = null;
let resizeFrame = 0;
let renderToken = 0;

const ensurePanzoom = async () => {
	if (!createPanzoom) {
		createPanzoom = (await import("@panzoom/panzoom")).default;
	}

	return createPanzoom;
};

const resetViewerState = () => {
	viewerReady.value = false;
	currentScale.value = 1;
	initialScale.value = 1;
	minScale.value = 1;
	maxScale.value = 1;
};

const cleanupViewer = () => {
	if (resizeFrame) {
		cancelAnimationFrame(resizeFrame);
		resizeFrame = 0;
	}

	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}

	if (viewport.value && wheelHandler) {
		viewport.value.removeEventListener("wheel", wheelHandler);
	}

	if (stage.value && changeHandler) {
		stage.value.removeEventListener("panzoomchange", changeHandler as EventListener);
	}

	wheelHandler = null;
	changeHandler = null;

	if (panzoom) {
		panzoom.destroy();
		panzoom.resetStyle();
		panzoom = null;
	}

	if (viewport.value) {
		viewport.value.style.height = "";
	}

	if (stage.value) {
		stage.value.style.transform = "";
	}

	resetViewerState();
};

const getDiagramSize = (svg: SVGSVGElement) => {
	const viewBox = svg.viewBox.baseVal;
	if (viewBox.width > 0 && viewBox.height > 0) {
		return { width: viewBox.width, height: viewBox.height };
	}

	const width = Number.parseFloat(svg.getAttribute("width") ?? "");
	const height = Number.parseFloat(svg.getAttribute("height") ?? "");
	if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
		return { width, height };
	}

	const box = svg.getBBox();
	return {
		width: box.width || 1,
		height: box.height || 1,
	};
};

const syncScaleState = () => {
	currentScale.value = panzoom?.getScale() ?? initialScale.value;
};

const applyInitialView = () => {
	if (!panzoom || !viewport.value || !stage.value) {
		return;
	}

	const svg = stage.value.querySelector("svg");
	if (!(svg instanceof SVGSVGElement)) {
		return;
	}

	const { width, height } = getDiagramSize(svg);
	const maxHeight = Math.min(window.innerHeight * MAX_VIEWPORT_HEIGHT_RATIO, MAX_VIEWPORT_HEIGHT);
	const preferredHeight = height + VIEWPORT_PADDING * 2;
	const viewportHeight = Math.min(maxHeight, Math.max(MIN_VIEWPORT_HEIGHT, preferredHeight));

	viewport.value.style.height = `${Math.round(viewportHeight)}px`;

	const availableWidth = Math.max(viewport.value.clientWidth - VIEWPORT_PADDING * 2, 1);
	const availableHeight = Math.max(viewport.value.clientHeight - VIEWPORT_PADDING * 2, 1);
	const fittedScale = Math.min(availableWidth / width, availableHeight / height, 1);
	const nextInitialScale = Number.isFinite(fittedScale) && fittedScale > 0 ? fittedScale : 1;
	const nextMinScale = Math.max(0.1, nextInitialScale * 0.75);
	const nextMaxScale = Math.max(4, nextInitialScale * 6);
	const startX = (viewport.value.clientWidth / nextInitialScale - width) / 2;
	const startY = (viewport.value.clientHeight / nextInitialScale - height) / 2;

	initialScale.value = nextInitialScale;
	minScale.value = nextMinScale;
	maxScale.value = nextMaxScale;

	panzoom.setOptions({
		maxScale: nextMaxScale,
		minScale: nextMinScale,
		startScale: nextInitialScale,
		startX,
		startY,
	});
	panzoom.reset({ animate: false, force: true });
	syncScaleState();
	viewerReady.value = true;
};

const setupViewer = async (token: number) => {
	if (!viewport.value || !stage.value) {
		return;
	}

	const svg = stage.value.querySelector("svg");
	if (!(svg instanceof SVGSVGElement)) {
		return;
	}

	const Panzoom = await ensurePanzoom();
	if (token !== renderToken || !stage.value || !viewport.value) {
		return;
	}

	panzoom = Panzoom(stage.value, {
		animate: true,
		canvas: true,
		cursor: "grab",
		panOnlyWhenZoomed: true,
		step: 0.2,
	});

	changeHandler = () => {
		syncScaleState();
	};
	stage.value.addEventListener("panzoomchange", changeHandler as EventListener);

	wheelHandler = (event: WheelEvent) => {
		const hasModifier = event.ctrlKey || event.metaKey;
		const hasActiveZoom = Math.abs(currentScale.value - initialScale.value) > SCALE_EPSILON;

		if (!panzoom || (!hasModifier && !hasActiveZoom)) {
			return;
		}

		event.preventDefault();
		panzoom.zoomWithWheel(event, {
			maxScale: maxScale.value,
			minScale: minScale.value,
			step: 0.15,
		});
		syncScaleState();
	};
	viewport.value.addEventListener("wheel", wheelHandler, { passive: false });

	resizeObserver = new ResizeObserver(() => {
		if (resizeFrame) {
			cancelAnimationFrame(resizeFrame);
		}

		resizeFrame = requestAnimationFrame(() => {
			applyInitialView();
		});
	});
	resizeObserver.observe(viewport.value);

	applyInitialView();
};

const renderDiagram = async () => {
	const token = ++renderToken;

	if (!stage.value) {
		return;
	}

	cleanupViewer();
	error.value = null;
	stage.value.innerHTML = "";

	try {
		mermaid.initialize({
			startOnLoad: false,
			theme: isDark.value ? "dark" : "default",
		});

		const id = `${instanceId}-${renderCount.value++}`;
		const { svg, bindFunctions } = await mermaid.render(id, source.value);
		if (token !== renderToken || !stage.value) {
			return;
		}

		stage.value.innerHTML = svg;
		bindFunctions?.(stage.value);

		await nextTick();
		if (token !== renderToken) {
			return;
		}

		await setupViewer(token);
	} catch (renderError) {
		if (token !== renderToken) {
			return;
		}

		error.value = renderError instanceof Error ? renderError.message : String(renderError);
	}
};

const zoomIn = () => {
	if (!panzoom) {
		return;
	}

	panzoom.zoomIn({ maxScale: maxScale.value });
	syncScaleState();
};

const zoomOut = () => {
	if (!panzoom) {
		return;
	}

	panzoom.zoomOut({ minScale: minScale.value });
	syncScaleState();
};

const resetView = () => {
	applyInitialView();
};

const scheduleRender = () => {
	void nextTick(renderDiagram);
};

watch(() => route.path, scheduleRender);
watch(() => isDark.value, scheduleRender);
watch(() => props.code, scheduleRender);

onMounted(() => {
	scheduleRender();
});

onBeforeUnmount(() => {
	renderToken += 1;
	cleanupViewer();
});
</script>

<template>
	<div class="mermaid-block">
		<div v-if="error" class="mermaid-error">
			<p>Mermaid 渲染失败</p>
			<pre>{{ error }}</pre>
		</div>
		<div v-else class="mermaid-viewer">
			<div ref="viewport" class="mermaid-viewport">
				<div ref="stage" class="mermaid-stage" />
			</div>
			<div class="mermaid-toolbar">
				<button
					type="button"
					class="mermaid-toolbar-button"
					aria-label="放大图表"
					:disabled="!canZoomIn"
					@click="zoomIn"
				>
					+
				</button>
				<button
					type="button"
					class="mermaid-toolbar-button"
					aria-label="缩小图表"
					:disabled="!canZoomOut"
					@click="zoomOut"
				>
					-
				</button>
				<button
					type="button"
					class="mermaid-toolbar-button mermaid-toolbar-reset"
					aria-label="重置图表视图"
					:disabled="!canReset"
					@click="resetView"
				>
					重置
				</button>
			</div>
		</div>
	</div>
</template>

<style scoped>
.mermaid-block {
	margin: 24px 0;
}

.mermaid-viewer {
	position: relative;
}

.mermaid-viewport {
	background: var(--vp-c-bg-soft);
	border: 1px solid var(--vp-c-divider);
	border-radius: 16px;
	min-height: 240px;
	overflow: hidden;
	position: relative;
}

.mermaid-stage {
	left: 0;
	position: absolute;
	top: 0;
	transform-origin: 0 0;
	width: max-content;
	will-change: transform;
}

.mermaid-stage :deep(svg) {
	display: block;
	height: auto;
	max-width: none;
}

.mermaid-toolbar {
	bottom: 16px;
	display: flex;
	gap: 8px;
	position: absolute;
	right: 16px;
	z-index: 1;
}

.mermaid-toolbar-button {
	background: color-mix(in srgb, var(--vp-c-bg) 92%, transparent);
	border: 1px solid var(--vp-c-divider);
	border-radius: 10px;
	box-shadow: 0 8px 24px color-mix(in srgb, var(--vp-c-text-1) 12%, transparent);
	color: var(--vp-c-text-1);
	cursor: pointer;
	font-size: 14px;
	font-weight: 600;
	line-height: 1;
	min-height: 36px;
	min-width: 36px;
	padding: 0 12px;
}

.mermaid-toolbar-button:disabled {
	cursor: not-allowed;
	opacity: 0.45;
}

.mermaid-toolbar-button:not(:disabled):hover {
	border-color: var(--vp-c-brand-1);
	color: var(--vp-c-brand-1);
}

.mermaid-toolbar-reset {
	min-width: 60px;
}

.mermaid-error {
	border: 1px solid var(--vp-c-danger-1);
	border-radius: 12px;
	color: var(--vp-c-danger-1);
	padding: 16px;
}

.mermaid-error p {
	font-weight: 600;
	margin: 0 0 8px;
}

.mermaid-error pre {
	font-size: 12px;
	margin: 0;
	overflow-x: auto;
	white-space: pre-wrap;
}

@media (max-width: 640px) {
	.mermaid-toolbar {
		bottom: 12px;
		right: 12px;
	}

	.mermaid-toolbar-button {
		min-height: 34px;
		min-width: 34px;
		padding: 0 10px;
	}
}
</style>
