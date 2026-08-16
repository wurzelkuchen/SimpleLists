<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
    <div class="w-full max-w-sm bg-[#FEF7FF] border border-[#CAC4D0] rounded-3xl shadow-2xl p-6 sm:p-7 overflow-hidden text-center">
      <div
        class="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center mb-4"
        :class="type === 'danger' ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-amber-100 text-amber-800 border border-amber-300'"
      >
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>

      <h3 class="text-base font-extrabold uppercase tracking-tight text-[#1D1B20] mb-2">{{ title }}</h3>
      <p class="text-xs font-medium text-[#49454F] mb-6 leading-relaxed">{{ message }}</p>

      <div class="flex items-center space-x-3">
        <button
          type="button"
          @click="$emit('cancel')"
          class="flex-1 py-3 bg-[#F3F0F7] hover:bg-[#E8DEF8] border border-[#CAC4D0] text-[#1D1B20] rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="$emit('confirm')"
          class="flex-1 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md"
          :class="[
            type === 'danger'
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-amber-600 hover:bg-amber-700 text-white'
          ]"
        >
          {{ confirmText }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  isOpen: Boolean,
  title: String,
  message: String,
  confirmText: {
    type: String,
    default: 'Confirm'
  },
  type: {
    type: String,
    default: 'danger' // 'danger' | 'warning'
  }
});

defineEmits(['confirm', 'cancel']);
</script>

