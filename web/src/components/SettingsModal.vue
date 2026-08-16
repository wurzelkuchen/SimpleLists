<template>
  <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
    <div class="w-full max-w-lg bg-[#FEF7FF] border border-[#CAC4D0] rounded-3xl shadow-2xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4 pb-2 border-b border-[#E6E0E9]">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-xl bg-[#E8DEF8] text-[#21005D] flex items-center justify-center font-bold">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h3 class="text-base font-extrabold uppercase tracking-tight text-[#1D1B20]">Settings & Sync</h3>
            <p class="text-xs font-semibold uppercase tracking-wider text-[#49454F]">P2P Network & Backup</p>
          </div>
        </div>
        <button
          @click="store.isSettingsModalOpen = false"
          class="p-1.5 rounded-full text-[#49454F] hover:text-[#1D1B20] hover:bg-[#F3F0F7]"
        >
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Settings Content -->
      <div class="flex-1 overflow-y-auto space-y-4 pr-1 text-xs sm:text-sm">
        <!-- Live Connection Status Card -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-3 shadow-sm">
          <div class="flex items-center justify-between">
            <span class="font-bold text-[#1D1B20] uppercase tracking-wider text-xs">P2P Mesh Status</span>
            <span
              class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              :class="[
                store.syncState.peerCount > 0 ? 'bg-[#E8DEF8] text-[#21005D] border border-[#CAC4D0]' :
                store.syncState.signalingState === 'connected' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                'bg-red-50 text-red-800 border border-red-200'
              ]"
            >
              <template v-if="store.syncState.peerCount > 0">
                {{ store.syncState.peerCount }} {{ store.syncState.peerCount === 1 ? 'Peer Connected' : 'Peers Connected' }}
              </template>
              <template v-else-if="store.syncState.signalingState === 'connected'">
                Signaling Ready (0 peers)
              </template>
              <template v-else>
                Signaling Offline
              </template>
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-[11px] font-mono text-[#49454F]">
            <div class="bg-[#F3F0F7] p-2.5 rounded-xl border border-[#CAC4D0]/60">
              <span class="text-[#79747E] block text-[10px] uppercase font-bold font-sans">Room ID</span>
              <span class="text-[#1D1B20] font-bold truncate block">{{ store.syncState.roomId ? store.syncState.roomId.substring(0, 12) + '...' : 'Not Joined' }}</span>
            </div>
            <div class="bg-[#F3F0F7] p-2.5 rounded-xl border border-[#CAC4D0]/60">
              <span class="text-[#79747E] block text-[10px] uppercase font-bold font-sans">Peer ID</span>
              <span class="text-[#1D1B20] font-bold truncate block">{{ store.syncState.myPeerId || 'N/A' }}</span>
            </div>
          </div>

          <!-- Signaling Connection Diagnostic Banner -->
          <div v-if="store.syncState.signalingError || store.syncState.signalingState === 'error'" class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900 space-y-1">
            <div class="font-bold flex items-center space-x-1.5">
              <svg class="w-4 h-4 text-amber-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Signaling Issue Detected</span>
            </div>
            <p class="text-amber-800">
              {{ store.syncState.signalingError || 'Connecting to public discovery network...' }}
            </p>
          </div>
        </div>

        <!-- Phrase Configuration Card -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-3 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="font-bold text-[#1D1B20] uppercase tracking-wider text-xs">Shared Phrase</div>
              <div class="text-xs text-[#49454F] font-mono mt-0.5 font-bold">{{ store.maskedPhrase || 'None' }}</div>
            </div>
            <button
              @click="confirmResetPhrase"
              class="px-3.5 py-1.5 bg-red-100 hover:bg-red-200 border border-red-300 text-red-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
            >
              Reset
            </button>
          </div>
          <p class="text-[11px] font-medium text-[#49454F]">
            Any devices using this exact shared phrase will automatically discover each other and sync lists in real-time.
          </p>
        </div>

        <!-- Custom Signaling URL & Presets -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-3 shadow-sm">
          <div class="flex items-center justify-between">
            <label class="block font-bold text-[#1D1B20] text-xs uppercase tracking-wider">
              Signaling Relay / Server
            </label>
            <span
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
              :class="store.syncState.signalingState === 'connected' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'"
            >
              {{ store.syncState.signalingState === 'connected' ? 'Connected' : store.syncState.signalingState }}
            </span>
          </div>

          <div class="flex items-center space-x-2">
            <input
              v-model="signalingInput"
              type="text"
              placeholder="public"
              class="flex-1 bg-[#F3F0F7] border border-[#CAC4D0] rounded-xl px-3 py-2 text-xs text-[#1D1B20] font-mono focus:outline-none focus:border-[#6750A4]"
            />
            <button
              @click="saveSignalingUrl"
              class="px-4 py-2 bg-[#6750A4] hover:bg-[#533f86] text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm"
            >
              Save
            </button>
          </div>

          <!-- Quick presets -->
          <div class="space-y-1 pt-1">
            <span class="text-[10px] font-bold text-[#79747E] uppercase tracking-wider block">Quick Presets:</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                @click="applyPreset('public')"
                class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-[11px] font-medium text-emerald-900 transition-colors"
                title="Global zero-setup public relay (default)"
              >
                🌐 Public Relay (Default)
              </button>
              <button
                @click="applyPreset('ws://localhost:8080')"
                class="px-2.5 py-1 bg-[#F3F0F7] hover:bg-[#E8DEF8] border border-[#CAC4D0] rounded-lg text-[11px] font-mono text-[#1D1B20] transition-colors"
              >
                Localhost (8080)
              </button>
              <button
                @click="applyPreset('ws://10.0.2.2:8080')"
                class="px-2.5 py-1 bg-[#F3F0F7] hover:bg-[#E8DEF8] border border-[#CAC4D0] rounded-lg text-[11px] font-mono text-[#1D1B20] transition-colors"
                title="Android Emulator host loopback"
              >
                Emulator (10.0.2.2:8080)
              </button>
            </div>
          </div>
        </div>

        <!-- Backup / Export Data -->
        <div class="bg-white border border-[#CAC4D0] rounded-2xl p-4 space-y-2 shadow-sm">
          <div class="font-bold text-[#1D1B20] text-xs uppercase tracking-wider">Data Backup & Export</div>
          <div class="flex items-center space-x-2 pt-1">
            <button
              @click="exportJsonBackup"
              class="px-3.5 py-2 bg-[#F3F0F7] hover:bg-[#E8DEF8] border border-[#CAC4D0] text-[#1D1B20] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5"
            >
              <svg class="w-4 h-4 text-[#6750A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export JSON</span>
            </button>
            <label
              class="px-3.5 py-2 bg-[#F3F0F7] hover:bg-[#E8DEF8] border border-[#CAC4D0] text-[#1D1B20] rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <svg class="w-4 h-4 text-[#6750A4]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span>Import JSON</span>
              <input type="file" accept=".json" @change="importJsonBackup" class="hidden" />
            </label>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="pt-4 border-t border-[#E6E0E9] flex justify-end">
        <button
          @click="store.isSettingsModalOpen = false"
          class="px-6 py-2.5 bg-[#6750A4] hover:bg-[#533f86] text-white rounded-2xl text-xs font-bold uppercase tracking-wider transition-colors shadow-sm"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useListStore } from '../stores/listStore.js';

const store = useListStore();
const emit = defineEmits(['request-confirm']);

const signalingInput = ref(store.signalingUrl);

function applyPreset(url) {
  signalingInput.value = url;
  store.updateSignalingUrl(url);
}

function saveSignalingUrl() {
  if (signalingInput.value.trim()) {
    store.updateSignalingUrl(signalingInput.value.trim());
  }
}

function confirmResetPhrase() {
  emit('request-confirm', {
    title: 'Change / Reset Phrase?',
    message: 'Resetting the shared phrase will disconnect this device from the current WebRTC sync room. You will need to enter a new phrase to reconnect.',
    confirmText: 'Reset Phrase',
    confirmType: 'danger',
    action: () => store.resetPhrase()
  });
}

function exportJsonBackup() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(store.lists, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `simple_lists_backup_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function importJsonBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const parsed = JSON.parse(event.target.result);
      if (Array.isArray(parsed)) {
        store.mergeRemoteState(parsed);
        alert('Data imported successfully!');
      }
    } catch (err) {
      alert('Invalid JSON backup file');
    }
  };
  reader.readAsText(file);
}
</script>

