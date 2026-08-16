<template>
  <div 
    class="relative overflow-hidden rounded-2xl my-2 transition-all select-none group shadow-sm"
    :class="[
      item.status === 'deleted' ? 'bg-red-50/60 border border-red-200' : 
      item.status === 'completed' ? 'bg-[#F3F0F7] border border-[#CAC4D0]/70' : 
      'bg-white border border-[#CAC4D0] hover:border-[#6750A4]/60'
    ]"
    data-test="item-row"
  >
    <!-- Background swipe indicators -->
    <div 
      class="absolute inset-0 flex items-center justify-between px-6 font-bold text-xs tracking-wider uppercase transition-colors"
      :class="swipeBackgroundClass"
    >
      <div class="flex items-center space-x-2" :class="swipeLeftIconClass">
        <span v-if="swipeDelta > 20">{{ swipeRightActionText }}</span>
      </div>
      <div class="flex items-center space-x-2" :class="swipeRightIconClass">
        <span v-if="swipeDelta < -20">{{ swipeLeftActionText }}</span>
      </div>
    </div>

    <!-- Main item card surface with touch swipe -->
    <div
      ref="cardSurface"
      class="relative flex items-center px-4 py-3.5 transition-transform duration-75 touch-pan-y"
      :class="[
        item.status === 'deleted' ? 'bg-red-50/60' : 
        item.status === 'completed' ? 'bg-[#F3F0F7]' : 
        'bg-white'
      ]"
      :style="{ transform: `translateX(${swipeDelta}px)` }"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend="handleTouchEnd"
      @touchcancel="handleTouchEnd"
    >
      <!-- Custom sort mode: Up/Down arrow buttons -->
      <div v-if="isCustomSort && item.status !== 'deleted'" class="flex flex-col mr-2 space-y-0.5 shrink-0">
        <button
          @click.stop="$emit('move', 'up')"
          class="p-1 text-[#49454F] hover:text-[#6750A4] active:scale-95 transition-colors"
          title="Move up"
          aria-label="Move item up"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          @click.stop="$emit('move', 'down')"
          class="p-1 text-[#49454F] hover:text-[#6750A4] active:scale-95 transition-colors"
          title="Move down"
          aria-label="Move item down"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <!-- Status toggle checkbox -->
      <button
        @click.stop="toggleStatus"
        class="w-6 h-6 rounded-lg mr-3.5 flex items-center justify-center border-2 transition-all shrink-0 active:scale-90"
        :class="[
          item.status === 'completed' ? 'bg-[#6750A4] border-[#6750A4] text-white shadow-sm' :
          item.status === 'deleted' ? 'bg-red-600 border-red-600 text-white' :
          'border-[#6750A4] bg-white hover:bg-[#E8DEF8]/40 text-transparent'
        ]"
        :title="item.status === 'completed' ? 'Mark open' : 'Mark completed'"
      >
        <svg v-if="item.status === 'completed'" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else-if="item.status === 'deleted'" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Item text / inline edit -->
      <div class="flex-1 min-w-0 pr-2">
        <form v-if="isEditing" @submit.prevent="saveEdit" class="flex items-center space-x-2">
          <input
            ref="editInput"
            v-model="editText"
            type="text"
            class="w-full bg-white border-2 border-[#6750A4] rounded-lg px-2.5 py-1 text-sm font-medium text-[#1D1B20] focus:outline-none shadow-sm"
            @blur="saveEdit"
            @keydown.esc="cancelEdit"
          />
        </form>
        <div
          v-else
          @click="startEdit"
          class="text-sm sm:text-base font-medium select-text cursor-pointer break-words leading-relaxed transition-all"
          :class="[
            item.status === 'completed' ? 'line-through text-[#79747E]' :
            item.status === 'deleted' ? 'line-through text-red-700/70 italic' :
            'text-[#1D1B20] hover:text-[#6750A4]'
          ]"
        >
          {{ item.text }}
        </div>
      </div>

      <!-- Quick status badge or delete tag -->
      <div class="flex items-center space-x-1 shrink-0">
        <span 
          v-if="item.status === 'deleted'" 
          class="text-[10px] uppercase font-bold tracking-wider text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full"
        >
          Deleted
        </span>
        <button
          @click.stop="startEdit"
          class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#49454F] hover:text-[#1D1B20] hover:bg-[#E8DEF8]/50 transition-all"
          title="Edit item text"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  isCustomSort: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update-status', 'update-text', 'move']);

// Inline edit state
const isEditing = ref(false);
const editText = ref('');
const editInput = ref(null);

function startEdit() {
  editText.value = props.item.text;
  isEditing.value = true;
  nextTick(() => {
    if (editInput.value) {
      editInput.value.focus();
      editInput.value.select();
    }
  });
}

function saveEdit() {
  if (!isEditing.value) return;
  const trimmed = editText.value.trim();
  if (trimmed && trimmed !== props.item.text) {
    emit('update-text', trimmed);
  }
  isEditing.value = false;
}

function cancelEdit() {
  isEditing.value = false;
}

function toggleStatus() {
  if (props.item.status === 'open') {
    emit('update-status', 'completed');
  } else if (props.item.status === 'completed') {
    emit('update-status', 'open');
  } else if (props.item.status === 'deleted') {
    emit('update-status', 'open');
  }
}

// Touch swipe logic
const touchStartX = ref(0);
const touchStartY = ref(0);
const swipeDelta = ref(0);
const isSwiping = ref(false);
const SWIPE_THRESHOLD = 75;

const swipeRightActionText = computed(() => {
  if (props.item.status === 'open') return 'Complete';
  if (props.item.status === 'completed') return 'Delete';
  return 'Restore';
});

const swipeLeftActionText = computed(() => {
  if (props.item.status === 'deleted') return 'Complete';
  if (props.item.status === 'completed') return 'Open';
  return 'Cancel';
});

const swipeBackgroundClass = computed(() => {
  if (swipeDelta.value > 20) {
    if (props.item.status === 'open') return 'bg-emerald-600 text-white';
    if (props.item.status === 'completed') return 'bg-red-600 text-white';
    return 'bg-[#6750A4] text-white';
  }
  if (swipeDelta.value < -20) {
    if (props.item.status === 'deleted') return 'bg-emerald-600 text-white';
    if (props.item.status === 'completed') return 'bg-[#6750A4] text-white';
    return 'bg-[#CAC4D0] text-[#1D1B20]';
  }
  return 'bg-[#F3F0F7]';
});

const swipeLeftIconClass = computed(() => {
  return swipeDelta.value > 20 ? 'opacity-100' : 'opacity-0';
});

const swipeRightIconClass = computed(() => {
  return swipeDelta.value < -20 ? 'opacity-100' : 'opacity-0';
});

function handleTouchStart(e) {
  if (isEditing.value) return;
  const touch = e.touches[0];
  touchStartX.value = touch.clientX;
  touchStartY.value = touch.clientY;
  isSwiping.value = true;
}

function handleTouchMove(e) {
  if (!isSwiping.value) return;
  const touch = e.touches[0];
  const deltaX = touch.clientX - touchStartX.value;
  const deltaY = touch.clientY - touchStartY.value;

  // If scrolling vertically, do not lock horizontal swipe
  if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(swipeDelta.value) < 10) {
    return;
  }

  // Apply slight damping resistance
  swipeDelta.value = deltaX * 0.75;
}

function handleTouchEnd() {
  if (!isSwiping.value) return;
  isSwiping.value = false;

  const finalDelta = swipeDelta.value;
  swipeDelta.value = 0;

  // Swipe Right: open -> completed -> deleted
  if (finalDelta >= SWIPE_THRESHOLD) {
    if (props.item.status === 'open') {
      emit('update-status', 'completed');
    } else if (props.item.status === 'completed') {
      emit('update-status', 'deleted');
    } else if (props.item.status === 'deleted') {
      emit('update-status', 'open');
    }
  } 
  // Swipe Left: deleted -> completed -> open
  else if (finalDelta <= -SWIPE_THRESHOLD) {
    if (props.item.status === 'deleted') {
      emit('update-status', 'completed');
    } else if (props.item.status === 'completed') {
      emit('update-status', 'open');
    }
  }
}
</script>

