<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none"
    @click.self="$emit('close')"
  >
    <div class="w-full max-w-md bg-[#FEF7FF] border border-[#CAC4D0] rounded-3xl shadow-2xl p-5 overflow-hidden flex flex-col max-h-[85vh]">
      <!-- Header -->
      <div class="flex items-center justify-between mb-3 pb-2.5 border-b border-[#E6E0E9]">
        <div class="flex items-center space-x-2.5 min-w-0">
          <div class="w-9 h-9 rounded-2xl bg-[#E8DEF8] text-[#21005D] flex items-center justify-center font-bold text-base shadow-sm shrink-0">
            📦
          </div>
          <div class="min-w-0">
            <h3 class="text-base font-extrabold uppercase tracking-tight text-[#1D1B20] truncate">
              Move "{{ folder?.name }}"
            </h3>
            <p class="text-xs font-semibold text-[#49454F] truncate">
              Select destination parent folder
            </p>
          </div>
        </div>
        <button
          type="button"
          @click="$emit('close')"
          class="p-2 rounded-full text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7] active:scale-95 transition-all shrink-0"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Destination Choice List -->
      <div class="flex-1 overflow-y-auto space-y-1.5 pr-1 py-1 text-xs">
        <!-- Root Level Choice -->
        <div
          @click="selectedParentId = null"
          class="p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all"
          :class="[
            selectedParentId === null
              ? 'bg-[#E8DEF8] border-[#6750A4] text-[#21005D] font-bold shadow-xs'
              : 'bg-white border-[#CAC4D0]/80 text-[#1D1B20] hover:bg-[#F3F0F7]'
          ]"
        >
          <div class="flex items-center space-x-2.5">
            <span class="text-base">🏠</span>
            <div>
              <div class="font-bold text-sm">Root Level</div>
              <div class="text-[10px] text-[#49454F]">Top level of the list (no parent folder)</div>
            </div>
          </div>
          <span
            v-if="folder?.parentId === null"
            class="text-[10px] font-bold uppercase tracking-wider text-[#79747E] bg-[#F3F0F7] px-2 py-0.5 rounded-md border border-[#CAC4D0]/60"
          >
            Current
          </span>
          <svg
            v-else-if="selectedParentId === null"
            class="w-5 h-5 text-[#6750A4]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <!-- Valid Destination Folders -->
        <div
          v-for="target in eligibleFolders"
          :key="target.id"
          @click="selectedParentId = target.id"
          class="p-2.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all"
          :class="[
            selectedParentId === target.id
              ? 'bg-[#E8DEF8] border-[#6750A4] text-[#21005D] font-bold shadow-xs'
              : 'bg-white border-[#CAC4D0]/70 text-[#1D1B20] hover:bg-[#F3F0F7]'
          ]"
          :style="{ paddingLeft: `${Math.min(target.depth, 6) * 14 + 12}px` }"
        >
          <div class="flex items-center space-x-2 min-w-0">
            <span v-if="target.depth > 0" class="text-neutral-400 font-mono text-xs">↳</span>
            <span class="text-sm">📁</span>
            <span class="font-bold text-xs truncate">{{ target.name }}</span>
          </div>

          <div class="flex items-center space-x-1.5 shrink-0 ml-2">
            <span
              v-if="folder?.parentId === target.id"
              class="text-[10px] font-bold uppercase tracking-wider text-[#79747E] bg-[#F3F0F7] px-2 py-0.5 rounded-md border border-[#CAC4D0]/60"
            >
              Current
            </span>
            <svg
              v-else-if="selectedParentId === target.id"
              class="w-5 h-5 text-[#6750A4]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <div v-if="eligibleFolders.length === 0" class="py-4 text-center text-xs text-[#79747E] italic">
          No other folders available to move into.
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="pt-3 border-t border-[#E6E0E9] flex items-center justify-end space-x-2">
        <button
          type="button"
          @click="$emit('close')"
          class="px-4 py-2 text-xs font-bold uppercase tracking-wider text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7] rounded-xl transition-colors active:scale-95"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="isUnchanged"
          @click="handleConfirmMove"
          class="px-5 py-2.5 bg-[#6750A4] hover:bg-[#533f86] active:scale-95 disabled:opacity-40 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm flex items-center space-x-1.5"
        >
          <span>Move Here</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  folder: {
    type: Object,
    default: null
  },
  allFolders: {
    type: Array,
    default: () => []
  },
  descendantIds: {
    type: Object, // Set
    default: () => new Set()
  }
});

const emit = defineEmits(['close', 'move']);

const selectedParentId = ref(null);

watch(() => props.folder, (newFolder) => {
  if (newFolder) {
    selectedParentId.value = newFolder.parentId || null;
  }
}, { immediate: true });

const eligibleFolders = computed(() => {
  if (!props.folder) return [];
  const currentId = props.folder.id;
  const descSet = props.descendantIds instanceof Set ? props.descendantIds : new Set(props.descendantIds || []);

  return props.allFolders.filter(f => {
    // Cannot move into itself
    if (f.id === currentId) return false;
    // Cannot move into any of its own descendants
    if (descSet.has(f.id)) return false;
    return true;
  });
});

const isUnchanged = computed(() => {
  if (!props.folder) return true;
  const currentParentId = props.folder.parentId || null;
  return selectedParentId.value === currentParentId;
});

function handleConfirmMove() {
  if (!props.folder || isUnchanged.value) return;
  emit('move', {
    folderId: props.folder.id,
    newParentId: selectedParentId.value
  });
}
</script>
