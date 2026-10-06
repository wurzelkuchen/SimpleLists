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
      class="relative flex px-4 py-3.5 transition-transform duration-75 touch-pan-y"
      :class="[
        isMultiline ? 'items-start' : 'items-center',
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
      <div 
        v-if="isCustomSort && item.status !== 'deleted'" 
        class="flex flex-col mr-2 space-y-0.5 shrink-0"
        :class="{ 'mt-0.5': isMultiline }"
      >
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
          isMultiline ? 'mt-0.5' : '',
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
        <!-- Edit Mode -->
        <div v-if="isEditing" class="w-full space-y-2 py-0.5">
          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-[#49454F] mb-1">
              Title
            </label>
            <input
              ref="editInput"
              v-model="editText"
              type="text"
              placeholder="Item title..."
              class="w-full bg-white border-2 border-[#6750A4] rounded-xl px-3 py-1.5 text-base sm:text-sm font-medium text-[#1D1B20] focus:outline-none shadow-sm transition-all"
              @keydown.enter.prevent="saveEdit"
              @keydown.esc="cancelEdit"
            />
          </div>

          <div>
            <label class="block text-[10px] font-bold uppercase tracking-wider text-[#49454F] mb-1">
              Details / Description (Optional)
            </label>
            <textarea
              ref="detailsInput"
              v-model="editDetails"
              rows="2"
              placeholder="Add a short description or notes..."
              class="w-full bg-white border border-[#CAC4D0] focus:border-[#6750A4] rounded-xl p-2.5 text-xs sm:text-sm font-normal text-[#1D1B20] placeholder-[#79747E] focus:outline-none shadow-sm transition-all resize-y"
              @keydown.enter.ctrl.prevent="saveEdit"
              @keydown.enter.meta.prevent="saveEdit"
              @keydown.esc="cancelEdit"
            ></textarea>
          </div>

          <div v-if="folders && folders.length > 0">
            <label class="block text-[10px] font-bold uppercase tracking-wider text-[#49454F] mb-1">
              Folder / Section
            </label>
            <select
              v-model="editFolderId"
              class="w-full bg-white border border-[#CAC4D0] focus:border-[#6750A4] rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#1D1B20] focus:outline-none shadow-sm transition-all"
            >
              <option :value="null">📁 General / Unassigned</option>
              <option v-for="f in folders" :key="f.id" :value="f.id">📁 {{ f.name }}</option>
            </select>
          </div>

          <div class="flex items-center justify-end space-x-2 pt-1">
            <button
              type="button"
              @click.stop="cancelEdit"
              class="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7] rounded-xl transition-colors active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              :disabled="!editText.trim()"
              @click.stop="saveEdit"
              class="px-4 py-1.5 bg-[#6750A4] hover:bg-[#533f86] active:scale-95 disabled:opacity-40 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center space-x-1.5"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
              </svg>
              <span>Save</span>
            </button>
          </div>
        </div>

        <!-- View Mode -->
        <div
          v-else
          @click="startEdit"
          class="cursor-pointer select-text group/item transition-all"
        >
          <div
            class="text-sm sm:text-base font-medium break-words leading-relaxed transition-all"
            :class="[
              item.status === 'completed' ? 'line-through text-[#79747E]' :
              item.status === 'deleted' ? 'line-through text-red-700/70 italic' :
              'text-[#1D1B20] group-hover/item:text-[#6750A4]'
            ]"
          >
            {{ item.text }}
          </div>
          <!-- Optional details section: if nothing is there don't show it -->
          <div
            v-if="hasDetails"
            class="text-xs sm:text-sm mt-1 whitespace-pre-line break-words leading-relaxed transition-all"
            :class="[
              item.status === 'completed' ? 'line-through text-[#79747E]/70' :
              item.status === 'deleted' ? 'line-through text-red-700/50 italic' :
              'text-[#49454F]'
            ]"
          >
            {{ item.details }}
          </div>

          <!-- Optional Folder Tag badge -->
          <div
            v-if="itemFolderName"
            class="inline-flex items-center space-x-1 mt-1.5 px-2 py-0.5 rounded-md bg-[#E8DEF8] text-[#21005D] text-[10px] font-bold uppercase tracking-wider"
          >
            <span>📁</span>
            <span>{{ itemFolderName }}</span>
          </div>
        </div>
      </div>

      <!-- Quick status badge or delete tag -->
      <div 
        class="flex items-center space-x-1 shrink-0"
        :class="{ 'mt-0.5': isMultiline }"
      >
        <span 
          v-if="item.status === 'deleted'" 
          class="text-[10px] uppercase font-bold tracking-wider text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full"
        >
          Deleted
        </span>
        <button
          v-if="!isEditing"
          @click.stop="startEdit"
          class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-[#49454F] hover:text-[#1D1B20] hover:bg-[#E8DEF8]/50 transition-all"
          title="Edit item"
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
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  item: {
    type: Object,
    required: true
  },
  isCustomSort: {
    type: Boolean,
    default: false
  },
  folders: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update-status', 'update-text', 'update-item', 'move']);

const hasDetails = computed(() => !!(props.item.details && props.item.details.trim()));
const itemFolderName = computed(() => {
  if (!props.item.folderId || !props.folders || props.folders.length === 0) return null;
  const f = props.folders.find(folder => folder.id === props.item.folderId);
  return f ? f.name : null;
});
const isMultiline = computed(() => isEditing.value || hasDetails.value || !!itemFolderName.value);

// Inline edit state
const isEditing = ref(false);
const editText = ref('');
const editDetails = ref('');
const editFolderId = ref(null);
const editInput = ref(null);
const detailsInput = ref(null);
const cardSurface = ref(null);

function startEdit() {
  editText.value = props.item.text;
  editDetails.value = props.item.details || '';
  editFolderId.value = props.item.folderId || null;
  isEditing.value = true;
  nextTick(() => {
    if (editInput.value) {
      editInput.value.focus();
      editInput.value.select();
      setTimeout(() => {
        if (editInput.value) {
          editInput.value.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }, 150);
    }
  });
}

function saveEdit() {
  if (!isEditing.value) return;
  const trimmedText = editText.value.trim();
  const trimmedDetails = editDetails.value.trim();

  // If title is empty, cancel rather than saving a blank item
  if (!trimmedText) {
    cancelEdit();
    return;
  }

  const textChanged = trimmedText !== props.item.text;
  const detailsChanged = trimmedDetails !== (props.item.details || '');
  const folderChanged = (editFolderId.value || null) !== (props.item.folderId || null);

  if (textChanged || detailsChanged || folderChanged) {
    emit('update-item', {
      text: trimmedText,
      details: trimmedDetails,
      folderId: editFolderId.value || null
    });
    emit('update-text', trimmedText);
  }
  isEditing.value = false;
}

function cancelEdit() {
  isEditing.value = false;
  editText.value = props.item.text;
  editDetails.value = props.item.details || '';
  editFolderId.value = props.item.folderId || null;
}

function handleClickOutside(e) {
  if (!isEditing.value) return;
  if (cardSurface.value && !cardSurface.value.contains(e.target)) {
    saveEdit();
  }
}

onMounted(() => {
  document.addEventListener('pointerdown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('pointerdown', handleClickOutside);
});

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

