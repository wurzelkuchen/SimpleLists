<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
    <div
      class="w-full sm:max-w-md bg-[#FEF7FF] border-t sm:border border-[#CAC4D0] rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 overflow-hidden"
    >
      <div class="flex items-center justify-between mb-4 pb-2 border-b border-[#E6E0E9]">
        <div class="flex items-center space-x-2.5">
          <div class="w-8 h-8 rounded-lg bg-[#E8DEF8] text-[#21005D] flex items-center justify-center font-bold">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-extrabold uppercase tracking-tight text-[#1D1B20]">Sort Items</h3>
          </div>
        </div>
        <button
          @click="$emit('close')"
          class="p-1.5 rounded-full text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7]"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="grid grid-cols-1 gap-2 max-h-[60vh] overflow-y-auto pr-1">
        <button
          v-for="opt in sortOptions"
          :key="opt.id"
          @click="selectSort(opt.id)"
          class="flex items-center justify-between p-3 rounded-2xl border text-sm font-semibold transition-all shadow-sm"
          :class="[
            store.sortMode === opt.id
              ? 'bg-[#E8DEF8] border-[#6750A4] text-[#21005D]'
              : 'bg-white border-[#CAC4D0]/70 text-[#1D1B20] hover:bg-[#F3F0F7]'
          ]"
        >
          <div class="flex items-center space-x-3">
            <span class="text-base">{{ opt.icon }}</span>
            <div class="text-left">
              <div class="font-bold text-sm tracking-tight">{{ opt.label }}</div>
              <div class="text-[11px] font-medium text-[#49454F]">{{ opt.desc }}</div>
            </div>
          </div>
          <svg
            v-if="store.sortMode === opt.id"
            class="w-5 h-5 text-[#6750A4]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </button>
      </div>

      <div class="mt-4 pt-3 border-t border-[#E6E0E9]">
        <button
          @click="$emit('close')"
          class="w-full py-3 bg-[#6750A4] hover:bg-[#533f86] text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
        >
          Done
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useListStore } from '../stores/listStore.js';

const store = useListStore();
const emit = defineEmits(['close']);

const sortOptions = [
  {
    id: 'custom',
    label: 'Custom (Manual)',
    desc: 'Arranged by manual position with Up/Down buttons',
    icon: '↕️'
  },
  {
    id: 'text-asc',
    label: 'Text: A to Z',
    desc: 'Alphabetical order',
    icon: '🔤'
  },
  {
    id: 'text-desc',
    label: 'Text: Z to A',
    desc: 'Reverse alphabetical order',
    icon: '🔡'
  },
  {
    id: 'status',
    label: 'Status',
    desc: 'Open first, then Completed, then Deleted',
    icon: '✅'
  },
  {
    id: 'created-desc',
    label: 'Created: Newest First',
    desc: 'Most recently added at the top',
    icon: '⏱️'
  },
  {
    id: 'created-asc',
    label: 'Created: Oldest First',
    desc: 'Initial items at the top',
    icon: '⏳'
  }
];

function selectSort(mode) {
  store.setSortMode(mode);
  emit('close');
}
</script>

