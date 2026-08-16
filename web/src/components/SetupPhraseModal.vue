<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
    <div class="w-full max-w-md bg-[#FEF7FF] border border-[#CAC4D0] rounded-3xl shadow-2xl p-6 sm:p-8 overflow-hidden text-center">
      <!-- Icon & Welcome Header -->
      <div class="w-16 h-16 rounded-2xl bg-[#6750A4] mx-auto flex items-center justify-center text-white shadow-lg mb-5">
        <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>

      <h2 class="text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-[#1D1B20] mb-2">Welcome to Simple Lists</h2>
      <p class="text-xs sm:text-sm font-medium text-[#49454F] mb-6 leading-relaxed">
        Enter your shared synchronization phrase. All devices using the exact same phrase discover each other automatically and synchronize lists peer-to-peer.
      </p>

      <!-- Phrase Input Form -->
      <form @submit.prevent="handleStart" class="space-y-4 text-left">
        <div>
          <label class="block text-xs font-bold uppercase tracking-wider text-[#1D1B20] mb-2">
            Shared Sync Phrase
          </label>
          <div class="relative">
            <input
              v-model="phraseInput"
              :type="showPassword ? 'text' : 'password'"
              placeholder="e.g. coffee-mountain-sunset-42"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              spellcheck="false"
              class="w-full bg-white border-2 border-[#CAC4D0] focus:border-[#6750A4] rounded-2xl px-4 py-3 text-sm font-bold text-[#1D1B20] placeholder-[#79747E] focus:outline-none shadow-sm font-mono tracking-wide"
            />
            <button
              type="button"
              @click="showPassword = !showPassword"
              class="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-[#49454F] hover:text-[#1D1B20]"
              :title="showPassword ? 'Hide phrase' : 'Show phrase'"
            >
              <svg v-if="showPassword" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
              </svg>
              <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          </div>
          <p class="mt-1.5 text-[11px] font-medium text-[#49454F]">
            Tip: Use 3–5 memorable words. Enter this phrase on all your devices.
          </p>
        </div>

        <button
          type="submit"
          :disabled="!phraseInput.trim()"
          class="w-full py-3.5 bg-[#6750A4] hover:bg-[#533f86] active:scale-[0.98] disabled:opacity-40 disabled:hover:bg-[#6750A4] disabled:active:scale-100 text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-all shadow-md flex items-center justify-center space-x-2"
        >
          <span>Connect & Start Syncing</span>
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </form>

      <!-- Trust note -->
      <div class="mt-6 pt-4 border-t border-[#E6E0E9] text-[11px] font-medium text-[#49454F] text-center">
        🔒 Offline-first. Zero accounts. Synchronization occurs directly between devices over encrypted WebRTC.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useListStore } from '../stores/listStore.js';

const store = useListStore();
const phraseInput = ref('');
const showPassword = ref(false);

async function handleStart() {
  if (phraseInput.value.trim()) {
    await store.configurePhrase(phraseInput.value.trim());
  }
}
</script>

