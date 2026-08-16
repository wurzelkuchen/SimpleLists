<template>
  <div class="p-3 sm:p-4 bg-[#FEF7FF]/95 backdrop-blur-md border-t border-[#E6E0E9] sticky bottom-0 z-20 shrink-0 select-none">
    <div class="max-w-4xl mx-auto">
      <form @submit.prevent="handleSubmit" class="flex items-center space-x-2.5">
        <div class="relative flex-1">
          <input
            ref="inputEl"
            v-model="text"
            type="text"
            placeholder="Add an item..."
            class="w-full bg-white border-2 border-[#CAC4D0] focus:border-[#6750A4] rounded-2xl pl-4 pr-10 py-3 text-sm sm:text-base font-medium text-[#1D1B20] placeholder-[#79747E] focus:outline-none shadow-sm transition-all"
          />
          <button
            v-if="text"
            type="button"
            @click="text = ''"
            class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-[#79747E] hover:text-[#1D1B20] rounded-full"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button
          type="submit"
          :disabled="!text.trim()"
          class="px-5 py-3 bg-[#6750A4] hover:bg-[#533f86] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#6750A4] disabled:active:scale-100 text-white rounded-2xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md flex items-center space-x-1.5 shrink-0"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 4v16m8-8H4" />
          </svg>
          <span class="hidden sm:inline">Add</span>
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const emit = defineEmits(['add']);
const text = ref('');
const inputEl = ref(null);

function handleSubmit() {
  const trimmed = text.value.trim();
  if (trimmed) {
    emit('add', trimmed);
    text.value = '';
  }
}
</script>

