<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
    <div class="w-full max-w-lg bg-[#FEF7FF] border border-[#CAC4D0] rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4 pb-2 border-b border-[#E6E0E9]">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-xl bg-[#E8DEF8] text-[#21005D] flex items-center justify-center font-bold">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-extrabold uppercase tracking-tight text-[#1D1B20]">Import Items</h3>
            <p class="text-xs font-semibold uppercase tracking-wider text-[#49454F]">Add to "{{ store.activeList?.name }}"</p>
          </div>
        </div>
        <button
          @click="store.isImportModalOpen = false"
          class="p-1.5 rounded-full text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7]"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Instructions & Textarea -->
      <div class="mb-4">
        <p class="text-xs font-medium text-[#49454F] mb-2">
          Paste or type items below. Each non-empty line becomes a new item in open status.
        </p>
        <textarea
          v-model="importText"
          rows="8"
          placeholder="Milk&#10;Eggs&#10;Sourdough Bread&#10;Apples"
          class="w-full bg-white border-2 border-[#CAC4D0] focus:border-[#6750A4] rounded-2xl p-3.5 text-sm font-medium text-[#1D1B20] placeholder-[#79747E] focus:outline-none shadow-sm font-sans"
        ></textarea>
        <div class="flex justify-between items-center mt-1.5 text-xs font-semibold uppercase tracking-wider text-[#49454F]">
          <span>{{ lineCount }} item(s) detected</span>
          <span>Empty lines ignored</span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center justify-end space-x-3 pt-3 border-t border-[#E6E0E9]">
        <button
          type="button"
          @click="store.isImportModalOpen = false"
          class="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#49454F] hover:text-[#1D1B20] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="lineCount === 0"
          @click="handleImport"
          class="px-6 py-2.5 bg-[#6750A4] hover:bg-[#533f86] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#6750A4] disabled:active:scale-100 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md"
        >
          Import {{ lineCount > 0 ? `(${lineCount})` : '' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useListStore } from '../stores/listStore.js';

const store = useListStore();
const importText = ref('');

const lineCount = computed(() => {
  if (!importText.value) return 0;
  return importText.value
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0).length;
});

function handleImport() {
  if (lineCount.value > 0 && store.activeList) {
    store.importItems(store.activeList.id, importText.value);
    importText.value = '';
  }
}
</script>

